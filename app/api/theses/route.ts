import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('API /api/theses вызван')
  try {
    const { content } = await request.json()
    console.log('Тело запроса на тезисы:', { content: content ? content.substring(0, 100) + '...' : 'empty' })

    if (!content || typeof content !== 'string') {
      console.error('Ошибка: Content is required for theses')
      return NextResponse.json(
        { error: 'Необходимо предоставить контент статьи для генерации тезисов' },
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

    // Ограничиваем длину контента для генерации тезисов (чтобы не превысить лимиты токенов)
    const contentForTheses = trimmedContent.substring(0, 8000) // Ограничиваем до 8000 символов
    
    if (contentForTheses.length < 50) {
      return NextResponse.json(
        { error: 'Контент статьи слишком короткий для генерации тезисов (минимум 50 символов)' },
        { status: 400 }
      )
    }
    
    console.log('Отправка запроса на генерацию тезисов в OpenRouter, длина контента:', contentForTheses.length)

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
            content: 'Ты профессиональный аналитик. Извлеки ключевые тезисы из следующей статьи и представь их в виде нумерованного списка на русском языке. Каждый тезис должен быть четким и информативным.'
          },
          {
            role: 'user',
            content: `Извлеки ключевые тезисы из следующей статьи:\n\n${contentForTheses}`
          }
        ],
        temperature: 0.4,
        max_tokens: 1500,
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
    
    const thesesText = data.choices[0].message.content
    if (!thesesText || thesesText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Не удалось сгенерировать тезисы. Попробуйте еще раз.' },
        { status: 500 }
      )
    }
    
    console.log('Тезисы успешно получены.')

    return NextResponse.json({
      theses: thesesText
    })

  } catch (error) {
    console.error('Theses error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate theses' },
      { status: 500 }
    )
  }
}

