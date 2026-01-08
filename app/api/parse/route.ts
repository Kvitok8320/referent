import { NextRequest, NextResponse } from 'next/server'
import cheerio from 'cheerio'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Получаем HTML страницы
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.statusText}` },
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

