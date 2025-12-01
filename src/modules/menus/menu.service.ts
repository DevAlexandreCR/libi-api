import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';

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
  });
  return menu;
}

export async function setMenuItemAvailability(menuItemId: string, isAvailable: boolean) {
  const item = await prisma.menuItem.update({ where: { id: menuItemId }, data: { isAvailable } });
  return item;
}

export async function replaceMenuFromJson(merchantId: string, menuJson: any) {
  await prisma.menu.updateMany({
    where: { merchantId },
    data: { isActive: false }
  });

  const menu = await prisma.menu.create({
    data: {
      merchantId,
      name: menuJson.name || 'Menu',
      isActive: true,
      categories: {
        create: (menuJson.categories || []).map((cat: any, idx: number) => ({
          name: cat.name,
          description: cat.description,
          position: cat.position ?? idx,
          items: {
            create: (cat.items || []).map((item: any, itemIdx: number) => ({
              name: item.name,
              description: item.description,
              basePrice: new Prisma.Decimal(item.base_price || 0),
              isAvailable: item.is_available ?? true,
              position: item.position ?? itemIdx,
              imageUrl: item.image_url,
              optionGroups: {
                create: (item.option_groups || []).map((og: any, ogIdx: number) => ({
                  name: og.name,
                  type: og.type === 'MULTIPLE' ? 'MULTIPLE' : 'SINGLE',
                  isRequired: og.is_required ?? false,
                  min: og.min ?? 0,
                  max: og.max ?? 1,
                  position: og.position ?? ogIdx,
                  options: {
                    create: (og.options || []).map((opt: any, optIdx: number) => ({
                      name: opt.name,
                      extraPrice: new Prisma.Decimal(opt.extra_price || 0),
                      position: opt.position ?? optIdx
                    }))
                  }
                }))
              }
            }))
          }
        }))
      }
    },
    include: {
      categories: {
        include: {
          items: { include: { optionGroups: { include: { options: true } } } }
        }
      }
    }
  });
  return menu;
}
