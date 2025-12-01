import { Prisma } from '@prisma/client'
import { prisma } from '../../prisma/client'

type ImportedMenuOption = {
  id?: string
  name?: string
  extra_price?: number
  position?: number
}

type ImportedMenuOptionGroup = {
  id?: string
  name?: string
  type?: string
  is_required?: boolean
  min?: number
  max?: number
  position?: number
  options?: ImportedMenuOption[]
}

type ImportedMenuItem = {
  id?: string
  name?: string
  description?: string
  base_price?: number
  image_url?: string | null
  is_available?: boolean
  position?: number
  option_groups?: ImportedMenuOptionGroup[]
}

type ImportedMenuCategory = {
  id?: string
  name?: string
  description?: string
  position?: number
  items?: ImportedMenuItem[]
}

type ImportedMenu = {
  menu_id?: string
  name?: string
  categories?: ImportedMenuCategory[]
}

export async function getActiveMenu(merchantId: string) {
  const menu = await prisma.menu.findFirst({
    where: { merchantId, isActive: true },
    include: {
      categories: {
        orderBy: { position: 'asc' },
        include: {
          items: {
            orderBy: { position: 'asc' },
            include: {
              optionGroups: {
                orderBy: { position: 'asc' },
                include: { options: { orderBy: { position: 'asc' } } }
              }
            }
          }
        }
      }
    }
  })
  return menu
}

export async function setMenuItemAvailability(menuItemId: string, isAvailable: boolean) {
  const item = await prisma.menuItem.update({ where: { id: menuItemId }, data: { isAvailable } })
  return item
}

export async function replaceMenuFromJson(merchantId: string, menuJson: ImportedMenu) {
  return prisma.$transaction(async (tx) => {
    await tx.menu.updateMany({ where: { merchantId }, data: { isActive: false } })

    const menu = await tx.menu.create({
      data: {
        merchantId,
        name: menuJson.name || 'Menu',
        isActive: true
      }
    })

    const categories = menuJson.categories || []
    for (const [catIdx, cat] of categories.entries()) {
      const createdCategory = await tx.menuCategory.create({
        data: {
          menuId: menu.id,
          name: cat.name || `Category ${catIdx + 1}`,
          description: cat.description,
          position: cat.position ?? catIdx
        }
      })

      const items = cat.items || []
      for (const [itemIdx, item] of items.entries()) {
        const createdItem = await tx.menuItem.create({
          data: {
            menuId: menu.id,
            categoryId: createdCategory.id,
            name: item.name || `Item ${itemIdx + 1}`,
            description: item.description,
            basePrice: new Prisma.Decimal(item.base_price ?? 0),
            isAvailable: item.is_available ?? true,
            position: item.position ?? itemIdx,
            imageUrl: item.image_url ?? undefined
          }
        })

        const optionGroups = item.option_groups || []
        for (const [ogIdx, og] of optionGroups.entries()) {
          const createdGroup = await tx.menuItemOptionGroup.create({
            data: {
              menuItemId: createdItem.id,
              name: og.name || `Options ${ogIdx + 1}`,
              type: og.type === 'MULTIPLE' ? 'MULTIPLE' : 'SINGLE',
              isRequired: og.is_required ?? false,
              min: og.min ?? 0,
              max: og.max ?? 1,
              position: og.position ?? ogIdx
            }
          })

          const options = og.options || []
          for (const [optIdx, opt] of options.entries()) {
            await tx.menuItemOption.create({
              data: {
                optionGroupId: createdGroup.id,
                name: opt.name || `Option ${optIdx + 1}`,
                extraPrice: new Prisma.Decimal(opt.extra_price ?? 0),
                position: opt.position ?? optIdx
              }
            })
          }
        }
      }
    }

    return tx.menu.findUnique({
      where: { id: menu.id },
      include: {
        categories: {
          orderBy: { position: 'asc' },
          include: {
            items: {
              orderBy: { position: 'asc' },
              include: {
                optionGroups: {
                  orderBy: { position: 'asc' },
                  include: { options: { orderBy: { position: 'asc' } } }
                }
              }
            }
          }
        }
      }
    })
  })
}
