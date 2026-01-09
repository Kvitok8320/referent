import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('API /api/image-prompt вызван')
  try {
    const { content, title } = await request.json()
    console.log('Тело запроса на промпт для изображения:', { 
      content: content ? content.substring(0, 100) + '...' : 'empty',
      title: title || 'not provided'
    })

    if (!content || typeof content !== 'string') {
      console.error('Ошибка: Content is required for image prompt')
      return NextResponse.json(
        { error: 'Необходимо предоставить контент статьи для генерации промпта изображения' },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      console.error('Ошибка: OpenRouter API key is not configured')
      return NextResponse.json(
        { error: 'API ключ OpenRouter не настроен. Добавьте OPENROUTER_API_KEY в файл .env.local и перезапустите сервер.' },
        { status: 500 }
      )
    }

    // Ограничиваем длину контента для генерации промпта
    const contentForPrompt = content.trim().substring(0, 5000) // Ограничиваем до 5000 символов
    
    if (contentForPrompt.length < 50) {
      return NextResponse.json(
        { error: 'Контент статьи слишком короткий для генерации промпта изображения (минимум 50 символов)' },
        { status: 400 }
      )
    }

    // Формируем промпт с учетом title, если есть
    let userMessage = 'Создай детальный промпт на английском языке для генерации изображения на основе следующей статьи. Промпт должен быть конкретным, описательным и подходить для генерации изображения через AI (например, Stable Diffusion). Включи описание стиля, настроения и ключевых элементов.\n\n'
    if (title) {
      userMessage += `Заголовок: ${title}\n\n`
    }
    userMessage += `Контент:\n${contentForPrompt}`

    console.log('Отправка запроса на генерацию промпта в OpenRouter')

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Referent App',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a professional prompt engineer for AI image generation. Create detailed, descriptive prompts in English for generating images based on articles. The prompts should be specific, include style descriptions, mood, and key visual elements suitable for AI image generation models like Stable Diffusion.'
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'No error data from OpenRouter' }))
      console.error('OpenRouter API error:', {
        status: response.status,
        statusText: response.statusText,
        errorData: errorData
      })
      
      let errorMessage = 'Ошибка при обращении к OpenRouter API'
      if (response.status === 401) {
        errorMessage = 'Неверный API ключ OpenRouter. Проверьте правильность ключа в .env.local'
      } else if (response.status === 429) {
        errorMessage = 'Превышен лимит запросов к OpenRouter API. Попробуйте позже'
      } else if (errorData.error?.message) {
        errorMessage = `Ошибка OpenRouter: ${errorData.error.message}`
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid response from OpenRouter API:', data)
      return NextResponse.json(
        { error: 'Получен некорректный ответ от OpenRouter API. Попробуйте еще раз.' },
        { status: 500 }
      )
    }
    
    const promptText = data.choices[0].message.content
    if (!promptText || promptText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Не удалось сгенерировать промпт для изображения. Попробуйте еще раз.' },
        { status: 500 }
      )
    }
    
    console.log('Промпт для изображения успешно получен.')

    return NextResponse.json({
      prompt: promptText.trim()
    })

  } catch (error) {
    console.error('Image prompt error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image prompt' },
      { status: 500 }
    )
  }
}

