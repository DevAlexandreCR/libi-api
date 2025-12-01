import fs from 'fs'
import { callOpenAI } from './openaiClient'
import { logger } from '../../utils/logger'

const systemPrompt = `You are an assistant that extracts structured restaurant menus from images.
You will receive one or multiple images of a fast-food restaurant menu (photos of a printed or digital menu).
Your task is to output a single JSON object in the following structure:

{
  "menu_id": "string",
  "name": "string",
  "categories": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "items": [
        {
          "id": "string",
          "name": "string",
          "description": "string",
          "base_price": 0,
          "image_url": null,
          "is_available": true,
          "option_groups": [
            {
              "id": "string",
              "name": "string",
              "type": "SINGLE or MULTIPLE",
              "is_required": false,
              "min": 0,
              "max": 0,
              "options": [
                { "id": "string", "name": "string", "extra_price": 0 }
              ]
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- Prices must be numeric (no currency symbol) and expressed in COP (Colombian Pesos).
- Group items into categories if the menu does so (e.g. Hamburguesas, Perros, Bebidas, Combos).
- If there are sizes or variants (e.g. small/large, combo/sandwich only), represent them as option_groups.
- Do not invent items that are not visible in the images.
- Output only the JSON, with no additional commentary.`

export type MenuExtractionFile = {
  path: string
  mimeType: string
  name: string
}

export async function extractMenuFromImages(files: MenuExtractionFile[]) {
  const imageContents = files.map((file) => {
    const buffer = fs.readFileSync(file.path)
    const base64 = buffer.toString('base64')
    return {
      type: 'image_url',
      image_url: {
        url: `data:${file.mimeType};base64,${base64}`,
        detail: 'high',
      },
    }
  })

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    {
      role: 'user' as const,
      content: [
        {
          type: 'text',
          text: 'Extract the unified JSON menu from the following images and respond ONLY with JSON. Prices must stay in COP.',
        },
        ...imageContents,
      ],
    },
  ]

  const response = await callOpenAI(messages, 'json_object')
  try {
    return JSON.parse(response.trim())
  } catch (err) {
    logger.error({ err, response }, 'Failed to parse menu extraction response')
    throw err
  }
}
