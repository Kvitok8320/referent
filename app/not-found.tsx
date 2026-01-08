export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">404</h2>
        <p className="text-gray-600 mb-4">Страница не найдена</p>
        <a
          href="/"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 inline-block"
        >
          Вернуться на главную
        </a>
      </div>
    </div>
  )
}

