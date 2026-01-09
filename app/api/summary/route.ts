import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('API /api/summary вызван')
  try {
    const { content } = await request.json()
    console.log('Тело запроса на краткое содержание:', { content: content ? content.substring(0, 100) + '...' : 'empty' })

    if (!content || typeof content !== 'string') {
      console.error('Ошибка: Content is required for summary')
      return NextResponse.json(
        { error: 'Необходимо предоставить контент статьи для генерации краткого содержания' },
        { status: 400 }
      )
    }

    // Проверяем, что контент не пустой после обрезки пробелов
    const trimmedContent = content.trim()
    if (trimmedContent.length === 0) {
      return NextResponse.json(
        { error: 'Контент статьи пуст. Сначала распарсите статью.' },
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

    // Ограничиваем длину контента для генерации краткого содержания (чтобы не превысить лимиты токенов)
    const contentToSummarize = trimmedContent.substring(0, 8000) // Ограничиваем до 8000 символов
    
    if (contentToSummarize.length < 50) {
      return NextResponse.json(
        { error: 'Контент статьи слишком короткий для генерации краткого содержания (минимум 50 символов)' },
        { status: 400 }
      )
    }
    
    console.log('Отправка запроса на генерацию краткого содержания в OpenRouter, длина контента:', contentToSummarize.length)

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
            content: 'Ты профессиональный аналитик текстов. Создай краткое содержание следующей статьи на русском языке (2-3 абзаца). Краткое содержание должно быть информативным и отражать основные идеи статьи.'
          },
          {
            role: 'user',
            content: `Создай краткое содержание следующей статьи:\n\n${contentToSummarize}`
          }
        ],
        temperature: 0.5,
        max_tokens: 1000,
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
      } else if (response.status === 500) {
        errorMessage = 'Внутренняя ошибка OpenRouter API. Попробуйте позже'
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
    
    const summaryText = data.choices[0].message.content
    if (!summaryText || summaryText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Не удалось сгенерировать краткое содержание. Попробуйте еще раз.' },
        { status: 500 }
      )
    }

    console.log('Краткое содержание успешно получено.')

    return NextResponse.json({
      summary: summaryText
    })

  } catch (error) {
    console.error('Summary error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate summary' },
      { status: 500 }
    )
  }
}

