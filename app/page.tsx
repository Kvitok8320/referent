'use client'

import { useState } from 'react'

type ActionType = 'summary' | 'theses' | 'telegram' | 'parse' | null

interface ParsedData {
  date: string | null
  title: string | null
  content: string | null
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionType, setActionType] = useState<ActionType>(null)
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)

  const handleParse = async () => {
    if (!url.trim()) {
      alert('Пожалуйста, введите URL статьи')
      return
    }

    setLoading(true)
    setActionType('parse')
    setResult('')
    setParsedData(null)

    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to parse article')
      }

      const data: ParsedData = await response.json()
      setParsedData(data)
      setResult(JSON.stringify(data, null, 2))
    } catch (error) {
      setResult(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (type: ActionType) => {
    if (!url.trim()) {
      alert('Пожалуйста, введите URL статьи')
      return
    }

    setLoading(true)
    setActionType(type)
    setResult('')

    // Здесь будет логика вызова AI API
    // Пока что просто имитация загрузки
    setTimeout(() => {
      setResult(`Результат для действия "${type}" будет здесь...`)
      setLoading(false)
    }, 1000)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
          Анализ статей
        </h1>

        {/* Поле ввода URL */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
            URL англоязычной статьи
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl((e.target as HTMLInputElement).value)}
            placeholder="https://example.com/article"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
          />
        </div>

        {/* Кнопка парсинга */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Парсинг статьи:</h2>
          <button
            onClick={handleParse}
            disabled={loading}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg"
          >
            {loading && actionType === 'parse' ? 'Парсинг...' : 'Распарсить статью'}
          </button>
        </div>

        {/* Кнопки действий */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Выберите действие:</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleAction('summary')}
              disabled={loading}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg"
            >
              О чем статья?
            </button>
            <button
              onClick={() => handleAction('theses')}
              disabled={loading}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg"
            >
              Тезисы
            </button>
            <button
              onClick={() => handleAction('telegram')}
              disabled={loading}
              className="px-6 py-3 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg"
            >
              Пост для Telegram
            </button>
          </div>
        </div>

        {/* Блок отображения результата */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            {actionType === 'parse' && 'Результат парсинга'}
            {actionType === 'summary' && 'О чем статья?'}
            {actionType === 'theses' && 'Тезисы'}
            {actionType === 'telegram' && 'Пост для Telegram'}
            {!actionType && 'Результат'}
          </h2>
          <div className="min-h-[200px] p-4 bg-gray-50 rounded-lg border border-gray-200">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <span className="ml-4 text-gray-600">Генерация результата...</span>
              </div>
            ) : result ? (
              <div className="text-gray-700">
                {actionType === 'parse' ? (
                  <pre className="bg-white p-4 rounded border overflow-auto max-h-[500px] text-sm">
                    {result}
                  </pre>
                ) : (
                  <div className="whitespace-pre-wrap">{result}</div>
                )}
              </div>
            ) : (
              <div className="text-gray-400 text-center py-12">
                Выберите действие для отображения результата
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
