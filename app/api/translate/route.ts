import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json()

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    console.log('API Key check:', apiKey ? `Key exists (length: ${apiKey.length})` : 'Key is missing')
    
    if (!apiKey) {
      console.error('OpenRouter API key is not configured in environment variables')
      return NextResponse.json(
        { error: 'OpenRouter API key is not configured. Please add OPENROUTER_API_KEY to .env.local file' },
        { status: 500 }
      )
    }

    // Ограничиваем длину контента для перевода (чтобы не превысить лимиты токенов)
    const contentToTranslate = content.substring(0, 10000) // Ограничиваем до 10000 символов
    
    console.log('Отправка запроса на перевод в OpenRouter, длина контента:', contentToTranslate.length)

    const requestBody = {
      model: 'deepseek/deepseek-chat',
      // Альтернативные варианты модели, если нужны:
      // 'deepseek/deepseek-chat:free' - бесплатная версия
      // 'deepseek/deepseek-chat:32k' - версия с большим контекстом
      messages: [
        {
          role: 'system',
          content: 'Ты профессиональный переводчик. Переведи следующий текст с английского на русский язык, сохраняя структуру и стиль оригинала.'
        },
        {
          role: 'user',
          content: `Переведи на русский язык следующий текст:\n\n${contentToTranslate}`
        }
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }

    console.log('Request body prepared, model:', requestBody.model)

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Referent App',
      },
      body: JSON.stringify(requestBody),
    })

    console.log('Response status:', response.status, response.statusText)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('OpenRouter API error details:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      })
      
      let errorMessage = `OpenRouter API error: ${response.statusText}`
      if (response.status === 401) {
        errorMessage = 'Неверный API-ключ. Проверьте, что OPENROUTER_API_KEY в .env.local правильный и сервер перезапущен после добавления ключа.'
      } else if (errorData.error) {
        errorMessage = `OpenRouter API error: ${errorData.error.message || errorData.error}`
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return NextResponse.json(
        { error: 'Invalid response from OpenRouter API' },
        { status: 500 }
      )
    }

    const translatedText = data.choices[0].message.content

    return NextResponse.json({
      translation: translatedText
    })

  } catch (error) {
    console.error('Translate error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to translate article' },
      { status: 500 }
    )
  }
}
