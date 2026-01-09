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
    // Попробуем несколько моделей, начиная с наиболее популярной
    const models = [
      'stabilityai/stable-diffusion-xl-base-1.0',
      'runwayml/stable-diffusion-v1-5',
      'CompVis/stable-diffusion-v1-4'
    ]
    
    // Используем первый доступный вариант
    const model = models[0]
    console.log('Отправка запроса на генерацию изображения в Hugging Face, модель:', model)

    // Пробуем несколько вариантов URL для нового endpoint
    // Вариант 1: https://router.huggingface.co/hf-inference/models/{model}
    // Вариант 2: https://router.huggingface.co/models/{model} (без /hf-inference/)
    // Вариант 3: Старый endpoint (может все еще работать для некоторых моделей)
    const apiUrls = [
      `https://router.huggingface.co/hf-inference/models/${model}`,
      `https://router.huggingface.co/models/${model}`,
      `https://api-inference.huggingface.co/models/${model}`
    ]
    
    let response: Response | null = null
    let lastError: any = null
    let lastUsedUrl: string = ''
    
    // Пробуем каждый URL по очереди
    for (const apiUrl of apiUrls) {
      lastUsedUrl = apiUrl
      try {
        console.log('Попытка запроса к:', apiUrl)
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            inputs: prompt,
          }),
        })
        
        // Если получили успешный ответ или ошибку, которая не 404, используем этот URL
        if (response.ok || (response.status !== 404 && response.status !== 400)) {
          console.log('Успешный запрос к:', apiUrl, 'статус:', response.status)
          break
        }
        
        // Если 404, пробуем следующий URL
        if (response.status === 404) {
          console.log('404 ошибка для:', apiUrl, 'пробуем следующий URL')
          const errorText = await response.text().catch(() => '')
          lastError = { status: 404, message: errorText || 'Not Found', url: apiUrl }
          response = null
          continue
        }
        
        // Для других ошибок останавливаемся
        break
      } catch (fetchError) {
        console.error('Ошибка при запросе к:', apiUrl, fetchError)
        lastError = fetchError
        response = null
        continue
      }
    }
    
    // Если все URL вернули ошибку, используем последний ответ или ошибку
    if (!response) {
      return NextResponse.json(
        { error: `Не удалось подключиться к Hugging Face API. Все варианты URL недоступны. Последняя ошибка: ${lastError?.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    if (!response.ok) {
      let errorData: any = {}
      const contentType = response.headers.get('content-type')
      
      try {
        if (contentType && contentType.includes('application/json')) {
          errorData = await response.json()
        } else {
          const text = await response.text()
          errorData = { message: text || 'Unknown error from Hugging Face' }
        }
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError)
        errorData = { message: `HTTP ${response.status}: ${response.statusText}` }
      }
      
      console.error('Hugging Face API error:', {
        status: response.status,
        statusText: response.statusText,
        contentType: contentType,
        errorData: errorData
      })
      
      let errorMessage = 'Ошибка при обращении к Hugging Face API'
      if (response.status === 401) {
        errorMessage = 'Неверный API ключ Hugging Face. Проверьте правильность ключа в .env.local'
      } else if (response.status === 404) {
        errorMessage = `Модель ${model} не найдена или недоступна через Inference API. Попробуйте другую модель или проверьте доступность модели на Hugging Face.`
      } else if (response.status === 503) {
        errorMessage = 'Модель загружается. Подождите немного и попробуйте снова.'
      } else if (response.status === 429) {
        errorMessage = 'Превышен лимит запросов к Hugging Face API. Попробуйте позже.'
      } else if (errorData.error) {
        errorMessage = `Ошибка Hugging Face: ${errorData.error}`
      } else if (errorData.message) {
        errorMessage = `Ошибка Hugging Face: ${errorData.message}`
      } else if (typeof errorData === 'string') {
        errorMessage = `Ошибка Hugging Face: ${errorData}`
      }
      
      console.error('Полная информация об ошибке:', {
        url: lastUsedUrl || 'unknown',
        status: response.status,
        errorData: errorData
      })
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    // Проверяем, что ответ действительно содержит изображение
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.startsWith('image/')) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error('Hugging Face returned non-image response:', {
        contentType: contentType,
        responsePreview: errorText.substring(0, 200)
      })
      return NextResponse.json(
        { error: 'Hugging Face API вернул неожиданный формат ответа. Возможно, модель недоступна или произошла ошибка.' },
        { status: 500 }
      )
    }
    
    // Hugging Face возвращает изображение в формате blob
    const imageBlob = await response.blob()
    
    // Проверяем размер изображения
    if (imageBlob.size === 0) {
      console.error('Hugging Face returned empty image blob')
      return NextResponse.json(
        { error: 'Получено пустое изображение от Hugging Face API. Попробуйте еще раз.' },
        { status: 500 }
      )
    }
    
    // Конвертируем blob в base64 для отправки клиенту
    const arrayBuffer = await imageBlob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Image = buffer.toString('base64')
    const mimeType = imageBlob.type || 'image/png'
    const dataUrl = `data:${mimeType};base64,${base64Image}`

    console.log('Изображение успешно сгенерировано. Размер:', imageBlob.size, 'байт, тип:', mimeType)

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

