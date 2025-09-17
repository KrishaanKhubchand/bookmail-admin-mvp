"use client"

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestPage() {
  const [result, setResult] = useState('Loading...')
  const [envInfo, setEnvInfo] = useState('')

  useEffect(() => {
    // Show environment info
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    setEnvInfo(`URL: ${url ? url.substring(0, 30) + '...' : 'Not set'} | Key: ${hasKey ? 'Set' : 'Not set'}`)

    async function test() {
      try {
        const { data, error } = await supabase.from('books').select('title, author')
        if (error) throw error
        setResult(`✅ Connected! Found ${data.length} books: ${data.map(b => b.title).join(', ')}`)
      } catch (err) {
        setResult(`❌ Error: ${err.message}`)
      }
    }
    test()
  }, [])

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl mb-4">Supabase Connection Test</h1>
      <div className="border p-4 rounded bg-gray-50">
        <div className="text-sm text-gray-600 mb-2">Environment:</div>
        <div className="font-mono text-sm">{envInfo}</div>
      </div>
      <div className="border p-4 rounded">
        <div className="text-sm text-gray-600 mb-2">Connection Test:</div>
        <div>{result}</div>
      </div>
    </div>
  )
}
