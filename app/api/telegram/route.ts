import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('API /api/telegram вызван')
  try {
    const { content, title, date } = await request.json()
    console.log('Тело запроса на Telegram-пост:', { 
      content: content ? content.substring(0, 100) + '...' : 'empty',
      title: title || 'not provided',
      date: date || 'not provided'
    })

    if (!content || typeof content !== 'string') {
      console.error('Ошибка: Content is required for telegram post')
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

    // Ограничиваем длину контента для генерации Telegram-поста (чтобы не превысить лимиты токенов)
    const contentForPost = content.substring(0, 10000) // Ограничиваем до 10000 символов
    console.log('Отправка запроса на генерацию Telegram-поста в OpenRouter, длина контента:', contentForPost.length)

    // Формируем промпт с учетом title и date, если они предоставлены
    let userMessage = 'Создай Telegram-пост на основе следующей статьи:\n\n'
    if (title) {
      userMessage += `Заголовок: ${title}\n`
    }
    if (date) {
      userMessage += `Дата: ${date}\n`
    }
    userMessage += `\nКонтент:\n${contentForPost}`

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
            content: 'Ты копирайтер для Telegram-каналов. Создай привлекательный пост на русском языке на основе следующей статьи. Используй эмодзи для визуального оформления, структурируй текст с помощью абзацев и списков, добавь призыв к действию в конце. Пост должен быть информативным, но при этом легко читаемым и интересным для аудитории Telegram.'
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
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

    const postText = data.choices[0].message.content
    console.log('Telegram-пост успешно получен.')

    return NextResponse.json({
      post: postText
    })

  } catch (error) {
    console.error('Telegram post error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate telegram post' },
      { status: 500 }
    )
  }
}

