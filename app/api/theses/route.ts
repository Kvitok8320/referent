import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('API /api/theses вызван')
  try {
    const { content } = await request.json()
    console.log('Тело запроса на тезисы:', { content: content ? content.substring(0, 100) + '...' : 'empty' })

    if (!content || typeof content !== 'string') {
      console.error('Ошибка: Content is required for theses')
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      console.error('Ошибка: OpenRouter API key is not configured')
      return NextResponse.json(
        { error: 'OpenRouter API key is not configured' },
        { status: 500 }
      )
    }

    // Ограничиваем длину контента для генерации тезисов (чтобы не превысить лимиты токенов)
    const contentForTheses = content.substring(0, 8000) // Ограничиваем до 8000 символов
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
      return NextResponse.json(
        { error: `OpenRouter API error: ${response.statusText} - ${errorData.message || JSON.stringify(errorData)}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid response from OpenRouter API:', data)
      return NextResponse.json(
        { error: 'Invalid response from OpenRouter API' },
        { status: 500 }
      )
    }

    const thesesText = data.choices[0].message.content
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

