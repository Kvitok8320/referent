'use client'

import { useState, useRef, useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert'

type ActionType = 'summary' | 'theses' | 'telegram' | 'image' | 'parse' | 'translate' | null

interface ParsedData {
  date: string | null
  title: string | null
  content: string | null
}

interface ErrorState {
  message: string
  variant: 'default' | 'destructive' | 'warning' | 'info'
}

// Функция для преобразования ошибок в дружественные сообщения
function getFriendlyErrorMessage(error: any, actionType: ActionType, statusCode?: number): ErrorState {
  // Ошибки загрузки статьи (404, 500, таймаут и т.п.)
  if (actionType === 'parse') {
    if (statusCode === 404 || statusCode === 500 || statusCode === 408 || statusCode === 503) {
      return {
        message: 'Не удалось загрузить статью по этой ссылке.',
        variant: 'destructive'
      }
    }
    if (statusCode === 403) {
      return {
        message: 'Доступ к статье заблокирован. Возможно, сайт защищен от автоматического доступа.',
        variant: 'destructive'
      }
    }
    if (error?.message?.toLowerCase().includes('timeout') || error?.message?.toLowerCase().includes('таймаут')) {
      return {
        message: 'Не удалось загрузить статью по этой ссылке. Превышено время ожидания.',
        variant: 'destructive'
      }
    }
    if (error?.message?.toLowerCase().includes('dns') || error?.message?.toLowerCase().includes('enotfound')) {
      return {
        message: 'Не удалось загрузить статью по этой ссылке. Проверьте правильность URL.',
        variant: 'destructive'
      }
    }
    if (error?.message?.toLowerCase().includes('cors')) {
      return {
        message: 'Не удалось загрузить статью по этой ссылке. Доступ заблокирован политикой безопасности.',
        variant: 'destructive'
      }
    }
  }

  // Ошибки API ключа
  if (error?.message?.toLowerCase().includes('api key') || error?.message?.toLowerCase().includes('api ключ')) {
    return {
      message: 'Ошибка настройки API. Обратитесь к администратору.',
      variant: 'destructive'
    }
  }

  // Ошибки перевода
  if (actionType === 'translate') {
    if (statusCode === 401) {
      return {
        message: 'Ошибка авторизации при переводе. Проверьте настройки API.',
        variant: 'destructive'
      }
    }
    return {
      message: 'Не удалось перевести статью. Попробуйте еще раз.',
      variant: 'destructive'
    }
  }

  // Ошибки генерации изображения
  if (actionType === 'image') {
    if (statusCode === 401) {
      return {
        message: 'Ошибка авторизации. Проверьте настройки API.',
        variant: 'destructive'
      }
    }
    if (statusCode === 503) {
      return {
        message: 'Модель генерации изображений загружается. Подождите немного и попробуйте снова.',
        variant: 'warning'
      }
    }
    if (statusCode === 429) {
      return {
        message: 'Превышен лимит запросов. Подождите немного и попробуйте снова.',
        variant: 'warning'
      }
    }
    return {
      message: 'Не удалось сгенерировать изображение. Попробуйте еще раз.',
      variant: 'destructive'
    }
  }

  // Ошибки генерации контента
  if (actionType === 'summary' || actionType === 'theses' || actionType === 'telegram') {
    if (statusCode === 401) {
      return {
        message: 'Ошибка авторизации. Проверьте настройки API.',
        variant: 'destructive'
      }
    }
    if (statusCode === 429) {
      return {
        message: 'Превышен лимит запросов. Подождите немного и попробуйте снова.',
        variant: 'warning'
      }
    }
    if (error?.message?.toLowerCase().includes('слишком короткий')) {
      return {
        message: 'Контент статьи слишком короткий для обработки. Попробуйте другую статью.',
        variant: 'warning'
      }
    }
    return {
      message: `Не удалось ${actionType === 'summary' ? 'сгенерировать краткое содержание' : actionType === 'theses' ? 'сгенерировать тезисы' : 'создать Telegram-пост'}. Попробуйте еще раз.`,
      variant: 'destructive'
    }
  }

  // Общие ошибки сети
  if (error?.message?.toLowerCase().includes('network') || error?.message?.toLowerCase().includes('fetch')) {
    return {
      message: 'Ошибка сети. Проверьте подключение к интернету.',
      variant: 'destructive'
    }
  }

  // Общие ошибки
  return {
    message: 'Произошла ошибка. Попробуйте еще раз.',
    variant: 'destructive'
  }
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [result, setResult] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionType, setActionType] = useState<ActionType>(null)
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [error, setError] = useState<ErrorState | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  // Функция для очистки всех состояний
  const handleClear = () => {
    setUrl('')
    setResult('')
    setImageUrl(null)
    setLoading(false)
    setActionType(null)
    setParsedData(null)
    setError(null)
  }

  // Функция для копирования результата в буфер обмена
  const handleCopy = async () => {
    if (!result) return
    
    try {
      await navigator.clipboard.writeText(result)
      // Можно добавить уведомление об успешном копировании
      alert('Результат скопирован в буфер обмена')
    } catch (err) {
      console.error('Ошибка при копировании:', err)
      alert('Не удалось скопировать результат')
    }
  }

  // Автоматическая прокрутка к результатам после успешной генерации
  useEffect(() => {
    if ((result || imageUrl) && !loading && resultRef.current) {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [result, imageUrl, loading])

  const handleParse = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault()
    e?.stopPropagation()
    
    console.log('handleParse вызван, URL:', url)
    
    if (!url.trim()) {
      alert('Пожалуйста, введите URL статьи')
      return
    }

    setLoading(true)
    setActionType('parse')
    setResult('')
    setImageUrl(null)
    setParsedData(null)
    setError(null)

    try {
      console.log('Отправка запроса на /api/parse с URL:', url.trim())
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      console.log('Ответ получен, status:', response.status)

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch (e) {
          // Если не удалось распарсить JSON, используем статус код
        }
        console.error('Ошибка API:', errorData)
        const friendlyError = getFriendlyErrorMessage(errorData, 'parse', response.status)
        setError(friendlyError)
        return
      }

      const data: ParsedData = await response.json()
      console.log('Данные получены:', data)
      setParsedData(data)
      setResult(JSON.stringify(data, null, 2))
      setError(null)
    } catch (error) {
      console.error('Ошибка в handleParse:', error)
      const friendlyError = getFriendlyErrorMessage(error, 'parse')
      setError(friendlyError)
    } finally {
      setLoading(false)
    }
  }

  const handleTranslate = async () => {
    if (!parsedData || !parsedData.content) {
      alert('Сначала распарсите статью, чтобы получить контент для перевода')
      return
    }

    setLoading(true)
    setActionType('translate')
    setResult('')
    setImageUrl(null)
    setError(null)

    try {
      console.log('Отправка запроса на перевод')
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: parsedData.content }),
      })

      console.log('Ответ получен, status:', response.status)

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch (e) {
          // Если не удалось распарсить JSON, используем статус код
        }
        console.error('Ошибка API:', errorData)
        const friendlyError = getFriendlyErrorMessage(errorData, 'translate', response.status)
        setError(friendlyError)
        return
      }

      const data = await response.json()
      console.log('Перевод получен')
      setResult(data.translation || 'Перевод не получен')
      setError(null)
    } catch (error) {
      console.error('Ошибка в handleTranslate:', error)
      const friendlyError = getFriendlyErrorMessage(error, 'translate')
      setError(friendlyError)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (type: 'summary' | 'theses' | 'telegram') => {
    if (!parsedData?.content) {
      alert('Сначала распарсите статью, чтобы получить контент для обработки')
      return
    }

    setLoading(true)
    setActionType(type)
    setResult('')
    setImageUrl(null)
    setError(null)

    try {
      const endpoint = `/api/${type}`
      const body: any = { content: parsedData.content }
      
      // Для telegram добавляем title и date, если есть
      if (type === 'telegram') {
        if (parsedData.title) {
          body.title = parsedData.title
        }
        if (parsedData.date) {
          body.date = parsedData.date
        }
      }

      console.log(`Отправка запроса на ${endpoint}`)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      console.log('Ответ получен, status:', response.status)

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch (e) {
          // Если не удалось распарсить JSON, используем статус код
        }
        console.error('Ошибка API:', errorData)
        const friendlyError = getFriendlyErrorMessage(errorData, type, response.status)
        setError(friendlyError)
        return
      }

      const data = await response.json()
      const resultKey = type === 'summary' ? 'summary' : type === 'theses' ? 'theses' : 'post'
      console.log('Результат получен:', resultKey)
      setResult(data[resultKey] || 'Результат не получен')
      setError(null)
    } catch (error) {
      console.error(`Ошибка в handleAction (${type}):`, error)
      const friendlyError = getFriendlyErrorMessage(error, type)
      setError(friendlyError)
    } finally {
      setLoading(false)
    }
  }

  const handleImage = async () => {
    if (!parsedData?.content) {
      alert('Сначала распарсите статью, чтобы получить контент для генерации изображения')
      return
    }

    setLoading(true)
    setActionType('image')
    setResult('')
    setImageUrl(null)
    setError(null)

    try {
      // Шаг 1: Генерация промпта для изображения
      console.log('Генерация промпта для изображения')
      const promptResponse = await fetch('/api/image-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          content: parsedData.content,
          title: parsedData.title || null
        }),
      })

      if (!promptResponse.ok) {
        let errorData: any = {}
        try {
          errorData = await promptResponse.json()
        } catch (e) {
          // Если не удалось распарсить JSON
        }
        console.error('Ошибка API промпта:', errorData)
        const friendlyError = getFriendlyErrorMessage(errorData, 'image', promptResponse.status)
        setError(friendlyError)
        return
      }

      const promptData = await promptResponse.json()
      const imagePrompt = promptData.prompt

      if (!imagePrompt) {
        setError({
          message: 'Не удалось сгенерировать промпт для изображения. Попробуйте еще раз.',
          variant: 'destructive'
        })
        return
      }

      console.log('Промпт получен, генерация изображения')

      // Шаг 2: Генерация изображения
      const imageResponse = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: imagePrompt }),
      })

      if (!imageResponse.ok) {
        let errorData: any = {}
        try {
          errorData = await imageResponse.json()
        } catch (e) {
          // Если не удалось распарсить JSON
        }
        console.error('Ошибка API изображения:', errorData)
        const friendlyError = getFriendlyErrorMessage(errorData, 'image', imageResponse.status)
        setError(friendlyError)
        return
      }

      const imageData = await imageResponse.json()
      console.log('Изображение получено')
      setImageUrl(imageData.image || null)
      setError(null)
    } catch (error) {
      console.error('Ошибка в handleImage:', error)
      const friendlyError = getFriendlyErrorMessage(error, 'image')
      setError(friendlyError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-6 sm:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800">
            Анализ статей
          </h1>
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors shadow-md hover:shadow-lg w-full sm:w-auto"
            title="Очистить все поля и результаты"
          >
            Очистить
          </button>
        </div>

        {/* Поле ввода URL */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
            URL англоязычной статьи
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading && url.trim()) {
                handleParse()
              }
            }}
            placeholder="https://example.com/article"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
          />
          <p className="mt-2 text-xs text-gray-500">
            Укажите ссылку на англоязычную статью
          </p>
        </div>

        {/* Кнопка парсинга */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-3 sm:mb-4">Парсинг статьи:</h2>
          <button
            type="button"
            onClick={(e) => {
              console.log('Кнопка нажата')
              handleParse(e)
            }}
            disabled={loading}
            title="Извлекает заголовок, дату публикации и основной контент из статьи по указанному URL"
            className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg"
          >
            {loading && actionType === 'parse' ? 'Парсинг...' : 'Распарсить статью'}
          </button>
        </div>

        {/* Кнопка перевода */}
        {parsedData && parsedData.content && (
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-3 sm:mb-4">Перевод статьи:</h2>
            <button
              type="button"
              onClick={handleTranslate}
              disabled={loading}
              title="Переводит распарсенную статью с английского языка на русский с сохранением структуры и стиля"
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg"
            >
              {loading && actionType === 'translate' ? 'Перевод...' : 'Перевести статью'}
            </button>
          </div>
        )}

        {/* Кнопки действий */}
        {parsedData && parsedData.content && (
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-700 mb-3 sm:mb-4">Выберите действие:</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <button
                onClick={() => handleAction('summary')}
                disabled={loading}
                title="Генерирует краткое содержание статьи на русском языке (2-3 абзаца) с основными идеями"
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg"
              >
                {loading && actionType === 'summary' ? 'Генерация...' : 'О чем статья?'}
              </button>
              <button
                onClick={() => handleAction('theses')}
                disabled={loading}
                title="Извлекает ключевые тезисы из статьи и представляет их в виде нумерованного списка на русском языке"
                className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg"
              >
                {loading && actionType === 'theses' ? 'Генерация...' : 'Тезисы'}
              </button>
              <button
                onClick={() => handleAction('telegram')}
                disabled={loading}
                title="Создает привлекательный пост для Telegram-канала с эмодзи, структурированным текстом и призывом к действию"
                className="px-6 py-3 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg"
              >
                {loading && actionType === 'telegram' ? 'Генерация...' : 'Пост для Telegram'}
              </button>
              <button
                onClick={handleImage}
                disabled={loading}
                title="Генерирует иллюстрацию к статье на основе ее содержания с помощью AI"
                className="px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg"
              >
                {loading && actionType === 'image' ? 'Генерация...' : 'Иллюстрация'}
              </button>
            </div>
          </div>
        )}

        {/* Блок ошибок */}
        {error && (
          <Alert variant={error.variant} className="mb-4 sm:mb-6 p-4">
            <AlertTitle className="mb-1">
              {error.variant === 'destructive' ? 'Ошибка' : error.variant === 'warning' ? 'Предупреждение' : 'Информация'}
            </AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {/* Блок статуса процесса */}
        {loading && actionType && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-blue-700 text-sm font-medium">
                {actionType === 'parse' && 'Загружаю статью...'}
                {actionType === 'translate' && 'Перевожу статью...'}
                {actionType === 'summary' && 'Генерирую краткое содержание...'}
                {actionType === 'theses' && 'Генерирую тезисы...'}
                {actionType === 'telegram' && 'Создаю Telegram-пост...'}
                {actionType === 'image' && 'Генерирую иллюстрацию...'}
              </span>
            </div>
          </div>
        )}

        {/* Блок отображения результата */}
        <div ref={resultRef} className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-700">
              {actionType === 'parse' && 'Результат парсинга'}
              {actionType === 'translate' && 'Перевод статьи'}
              {actionType === 'summary' && 'О чем статья?'}
              {actionType === 'theses' && 'Тезисы'}
              {actionType === 'telegram' && 'Пост для Telegram'}
              {actionType === 'image' && 'Иллюстрация'}
              {!actionType && 'Результат'}
            </h2>
            {result && !loading && actionType !== 'image' && (
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg text-sm w-full sm:w-auto"
                title="Копировать результат в буфер обмена"
              >
                Копировать
              </button>
            )}
          </div>
          <div className="min-h-[200px] p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
            {loading ? (
              <div className="flex flex-col sm:flex-row items-center justify-center h-full gap-3 sm:gap-4">
                <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-indigo-600"></div>
                <span className="text-sm sm:text-base text-gray-600 text-center sm:text-left">
                  {actionType === 'summary' && 'Генерация краткого содержания...'}
                  {actionType === 'theses' && 'Генерация тезисов...'}
                  {actionType === 'telegram' && 'Генерация Telegram-поста...'}
                  {actionType === 'parse' && 'Парсинг статьи...'}
                  {actionType === 'translate' && 'Перевод статьи...'}
                  {actionType === 'image' && 'Генерация иллюстрации...'}
                  {!actionType && 'Генерация результата...'}
                </span>
              </div>
            ) : imageUrl ? (
              <div className="flex flex-col items-center justify-center p-2">
                <img 
                  src={imageUrl} 
                  alt="Сгенерированная иллюстрация к статье" 
                  className="max-w-full h-auto rounded-lg shadow-md mb-4 w-full sm:max-w-2xl"
                />
                <a
                  href={imageUrl}
                  download="illustration.png"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg text-sm w-full sm:w-auto text-center"
                >
                  Скачать изображение
                </a>
              </div>
            ) : result ? (
              <div className="text-gray-700">
                {actionType === 'parse' ? (
                  <pre className="bg-white p-3 sm:p-4 rounded border overflow-auto max-h-[500px] text-xs sm:text-sm break-words">
                    {result}
                  </pre>
                ) : (
                  <div className="whitespace-pre-wrap break-words text-sm sm:text-base">{result}</div>
                )}
              </div>
            ) : (
              <div className="text-gray-400 text-center py-8 sm:py-12 text-sm sm:text-base px-2">
                Выберите действие для отображения результата
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
