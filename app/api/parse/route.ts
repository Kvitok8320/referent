import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function POST(request: NextRequest) {
  console.log('API /api/parse вызван')
  try {
    const body = await request.json()
    console.log('Тело запроса:', body)
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Валидация и нормализация URL
    let normalizedUrl = url.trim()
    try {
      const urlObj = new URL(normalizedUrl)
      // Проверяем, что это http или https
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return NextResponse.json(
          { error: 'URL должен использовать протокол HTTP или HTTPS' },
          { status: 400 }
        )
      }
      normalizedUrl = urlObj.toString()
    } catch (urlError) {
      return NextResponse.json(
        { error: 'Некорректный URL. Убедитесь, что URL начинается с http:// или https://' },
        { status: 400 }
      )
    }

    // Получаем HTML страницы
    let response: Response
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 секунд
    
    try {
      console.log('Попытка загрузки URL:', normalizedUrl)
      response = await fetch(normalizedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal,
        redirect: 'follow',
        // Добавляем опции для работы с различными сайтами
        cache: 'no-store',
      })
      clearTimeout(timeoutId)
      console.log('Ответ получен, status:', response.status, response.statusText)
    } catch (fetchError) {
      clearTimeout(timeoutId)
      console.error('Fetch error details:', {
        error: fetchError,
        name: fetchError instanceof Error ? fetchError.name : 'Unknown',
        message: fetchError instanceof Error ? fetchError.message : String(fetchError),
        stack: fetchError instanceof Error ? fetchError.stack : undefined,
        url: normalizedUrl
      })
      
      if (fetchError instanceof Error) {
        const errorMessage = fetchError.message.toLowerCase()
        const errorName = fetchError.name.toLowerCase()
        
        if (errorName === 'aborterror' || errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
          return NextResponse.json(
            { error: 'Request timeout: URL не отвечает в течение 30 секунд' },
            { status: 408 }
          )
        }
        if (errorMessage.includes('cors') || errorMessage.includes('cross-origin')) {
          return NextResponse.json(
            { error: 'CORS error: Доступ к URL заблокирован политикой безопасности' },
            { status: 403 }
          )
        }
        if (errorMessage.includes('enotfound') || errorMessage.includes('getaddrinfo') || errorMessage.includes('dns')) {
          return NextResponse.json(
            { error: 'DNS error: Не удалось найти сервер. Проверьте правильность URL' },
            { status: 404 }
          )
        }
        if (errorMessage.includes('econnrefused') || errorMessage.includes('connection refused')) {
          return NextResponse.json(
            { error: 'Connection refused: Сервер отклонил подключение' },
            { status: 503 }
          )
        }
        if (errorMessage.includes('certificate') || errorMessage.includes('ssl') || errorMessage.includes('tls')) {
          return NextResponse.json(
            { error: 'SSL/TLS error: Проблема с сертификатом безопасности. Попробуйте другой URL' },
            { status: 495 }
          )
        }
        if (errorMessage.includes('fetch failed') || errorMessage.includes('network')) {
          return NextResponse.json(
            { error: `Ошибка сети: ${fetchError.message}. Проверьте подключение к интернету и правильность URL` },
            { status: 500 }
          )
        }
        return NextResponse.json(
          { error: `Ошибка при загрузке страницы: ${fetchError.message} (${fetchError.name})` },
          { status: 500 }
        )
      }
      return NextResponse.json(
        { error: `Неизвестная ошибка при загрузке страницы: ${String(fetchError)}` },
        { status: 500 }
      )
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `HTTP ${response.status}: ${response.statusText}` },
        { status: response.status }
      )
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Извлечение заголовка
    let title = ''
    const titleSelectors = [
      'h1',
      'article h1',
      '.post-title',
      '.article-title',
      '[class*="title"]',
      'title'
    ]
    
    for (const selector of titleSelectors) {
      const found = $(selector).first().text().trim()
      if (found && found.length > 10) {
        title = found
        break
      }
    }

    // Если не нашли, берем из meta тегов
    if (!title) {
      title = $('meta[property="og:title"]').attr('content') || 
              $('meta[name="title"]').attr('content') || 
              $('title').text().trim() || 
              ''
    }

    // Извлечение даты
    let date = ''
    const dateSelectors = [
      'time[datetime]',
      'time',
      '[class*="date"]',
      '[class*="published"]',
      '[class*="time"]',
      'article time',
      '.post-date',
      '.article-date',
      'meta[property="article:published_time"]',
      'meta[name="date"]',
      'meta[name="publish-date"]'
    ]

    for (const selector of dateSelectors) {
      const element = $(selector).first()
      const found = element.attr('datetime') || 
                   element.attr('content') || 
                   element.text().trim()
      if (found) {
        date = found
        break
      }
    }

    // Извлечение основного контента
    let content = ''
    const contentSelectors = [
      'article',
      '.post',
      '.content',
      '.article-content',
      '[class*="article"]',
      '[class*="post-content"]',
      '[class*="entry-content"]',
      'main article',
      '.post-body',
      '.article-body'
    ]

    for (const selector of contentSelectors) {
      const found = $(selector).first()
      if (found.length > 0) {
        // Удаляем скрипты, стили и другие ненужные элементы
        found.find('script, style, nav, aside, footer, header, .ad, .advertisement, .sidebar').remove()
        const text = found.text().trim()
        if (text && text.length > 100) {
          content = text
          break
        }
      }
    }

    // Если не нашли, пытаемся найти основной контент по структуре
    if (!content) {
      const mainContent = $('main, [role="main"]').first()
      if (mainContent.length > 0) {
        mainContent.find('script, style, nav, aside, footer, header').remove()
        content = mainContent.text().trim()
      }
    }

    // Очистка контента от лишних пробелов и переносов
    if (content) {
      content = content.replace(/\s+/g, ' ').trim()
    }

    return NextResponse.json({
      date: date || null,
      title: title || null,
      content: content || null
    })

  } catch (error) {
    console.error('Parse error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse article' },
      { status: 500 }
    )
  }
}

