import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('API /api/generate-image вызван')
  try {
    const { prompt } = await request.json()
    console.log('Тело запроса на генерацию изображения:', { prompt: prompt ? prompt.substring(0, 100) + '...' : 'empty' })

    if (!prompt || typeof prompt !== 'string') {
      console.error('Ошибка: Prompt is required for image generation')
      return NextResponse.json(
        { error: 'Необходимо предоставить промпт для генерации изображения' },
        { status: 400 }
      )
    }

    const apiKey = process.env.API_KEY_IMAGE
    if (!apiKey) {
      console.error('Ошибка: Hugging Face API key is not configured')
      return NextResponse.json(
        { error: 'API ключ Hugging Face не настроен. Добавьте API_KEY_IMAGE в файл .env.local и перезапустите сервер.' },
        { status: 500 }
      )
    }

    // Используем Hugging Face Inference API для генерации изображения
    // Популярная модель для генерации изображений: stabilityai/stable-diffusion-xl-base-1.0
    const model = 'stabilityai/stable-diffusion-xl-base-1.0'
    
    console.log('Отправка запроса на генерацию изображения в Hugging Face, модель:', model)

    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: prompt,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'No error data from Hugging Face' }))
      console.error('Hugging Face API error:', {
        status: response.status,
        statusText: response.statusText,
        errorData: errorData
      })
      
      let errorMessage = 'Ошибка при обращении к Hugging Face API'
      if (response.status === 401) {
        errorMessage = 'Неверный API ключ Hugging Face. Проверьте правильность ключа в .env.local'
      } else if (response.status === 503) {
        errorMessage = 'Модель загружается. Подождите немного и попробуйте снова.'
      } else if (errorData.error) {
        errorMessage = `Ошибка Hugging Face: ${errorData.error}`
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    // Hugging Face возвращает изображение в формате blob
    const imageBlob = await response.blob()
    
    // Конвертируем blob в base64 для отправки клиенту
    const arrayBuffer = await imageBlob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Image = buffer.toString('base64')
    const mimeType = imageBlob.type || 'image/png'
    const dataUrl = `data:${mimeType};base64,${base64Image}`

    console.log('Изображение успешно сгенерировано.')

    return NextResponse.json({
      image: dataUrl
    })

  } catch (error) {
    console.error('Generate image error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    )
  }
}

