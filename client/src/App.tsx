import { Router, Route } from 'wouter'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-gray-900">CLIRDEC:PRESENCE</h1>
          </div>
        </header>
        <main>
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <Route path="/" component={Home} />
            <Route path="/attendance" component={Attendance} />
            <Route path="/students" component={Students} />
            <Route path="/reports" component={Reports} />
          </div>
        </main>
      </div>
    </Router>
  )
}

function Home() {
  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
        <p className="text-gray-500 text-lg">Welcome to CLIRDEC:PRESENCE</p>
      </div>
    </div>
  )
}

function Attendance() {
  return <div>Attendance Page</div>
}

function Students() {
  return <div>Students Page</div>
}

function Reports() {
  return <div>Reports Page</div>
}

export default App