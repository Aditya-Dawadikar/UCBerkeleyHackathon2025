import { useState, useEffect, useRef } from 'react'
import { vapi } from './vapi'

const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY
const VAPI_AGENT_ID = import.meta.env.VITE_VAPI_AGENT_ID

const CALL_STATUS = {
  INACTIVE: 'inactive',
  ACTIVE: 'active',
  LOADING: 'loading'
}

function App() {
  const [callStatus, setCallStatus] = useState(CALL_STATUS.INACTIVE)
  const [assistantIsSpeaking, setAssistantIsSpeaking] = useState(false)
  const [error, setError] = useState('')
  const [volumeLevel, setVolumeLevel] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [messages, setMessages] = useState([])
  const [activeTranscript, setActiveTranscript] = useState(null)
  const messagesEndRef = useRef(null)

  const isLoading = callStatus === CALL_STATUS.LOADING
  const isActive = callStatus === CALL_STATUS.ACTIVE

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeTranscript])

  useEffect(() => {
    if (!VAPI_PUBLIC_KEY || VAPI_PUBLIC_KEY === 'your_vapi_public_key_here') {
      setError('Please add your Vapi API key to .env file')
      return
    }

    const onCallStart = () => {
      setCallStatus(CALL_STATUS.ACTIVE)
      setError('')
      addMessage('system', '📞 Call connected')
    }

    const onCallEnd = () => {
      setCallStatus(CALL_STATUS.INACTIVE)
      setAssistantIsSpeaking(false)
      setVolumeLevel(0)
      setActiveTranscript(null)
      addMessage('system', '📴 Call ended')
    }

    const onSpeechStart = () => setAssistantIsSpeaking(true)
    const onSpeechEnd = () => setAssistantIsSpeaking(false)
    const onVolumeLevel = (vol) => setVolumeLevel(vol)

    const onMessage = (msg) => {
      if (msg.type === 'transcript') {
        if (msg.transcriptType === 'partial') {
          setActiveTranscript({
            role: msg.role,
            text: msg.transcript,
            timestamp: Date.now()
          })
        } else {
          setActiveTranscript(null)
          addMessage(msg.role, msg.transcript)
        }
      } else if (msg.type === 'function-call') {
        addMessage('system', `🔧 Function called: ${msg.functionCall.name}`)
      } else if (msg.type === 'hang') {
        addMessage('system', '👋 Call ended by assistant')
      }
    }

    const onError = (err) => {
      setError(err.message || 'An error occurred')
      setCallStatus(CALL_STATUS.INACTIVE)
      addMessage('system', `❌ Error: ${err.message || err}`)
    }

    vapi.on('call-start', onCallStart)
    vapi.on('call-end', onCallEnd)
    vapi.on('speech-start', onSpeechStart)
    vapi.on('speech-end', onSpeechEnd)
    vapi.on('volume-level', onVolumeLevel)
    vapi.on('message', onMessage)
    vapi.on('error', onError)

    return () => {
      vapi.off('call-start', onCallStart)
      vapi.off('call-end', onCallEnd)
      vapi.off('speech-start', onSpeechStart)
      vapi.off('speech-end', onSpeechEnd)
      vapi.off('volume-level', onVolumeLevel)
      vapi.off('message', onMessage)
      vapi.off('error', onError)
    }
  }, [])

  const addMessage = (type, content) => {
    const newMsg = {
      id: Date.now(),
      type,
      content,
      time: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    setMessages(prev => [...prev, newMsg])
  }

  const toggleCall = async () => {
    if (isActive) {
      setCallStatus(CALL_STATUS.LOADING)
      vapi.stop()
    } else if (!isLoading) {
      setCallStatus(CALL_STATUS.LOADING)
      setError('')
      addMessage('system', '🔄 Starting call...')
      
      try {
        await vapi.start(VAPI_AGENT_ID)
      } catch (error) {
        console.error('Failed to start call:', error)
        setError('Failed to connect. Please check your API key and internet connection.')
        setCallStatus(CALL_STATUS.INACTIVE)
      }
    }
  }

  return (
    <div className="bg-black text-cyan-300 font-[VT323] text-xl p-6 min-h-screen flex flex-col items-center justify-start">
      {/* ASCII Banner */}
      <pre className="text-cyan-400 text-lg leading-tight font-bold tracking-wider">
{`+------------------------------------------+
|     ____       _       ____   _____      |
|    / ___|     / \\     / ___| | ____|     |
|    \\___ \\    / _ \\   | |  _  |  _|       |
|     ___) |  / ___ \\  | |_| | | |___      |
|    |____/  /_/   \\_\\  \\____| |_____|     |
|                                          |
+------------------------------------------+`}
      </pre>

      {/* Subtitles */}
      <p className="subtext text-cyan-300">SAGE: System for Automatic Gyan Extraction</p>
      <p className="sysinfo text-cyan-500">[v1.0.1] - [ {isLoading ? 'Connecting' : isActive ? 'Session Live' : 'Ready to Connect'} ]</p>
      <p className="cursor text-cyan-400">&gt;</p>

      {/* Message Log Area */}
      <div className="w-full max-w-3xl h-[800px] overflow-y-scroll scrollbar-hide border border-cyan-700 p-4 rounded-md bg-black/80 space-y-2 mt-4">
        {messages.length === 0 && !activeTranscript ? (
          <div className="text-center text-cyan-600 mt-24">
            <p className="mb-2">[ SYSTEM READY ]</p>
            <p>Press START VOICE CHAT to begin...</p>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <div key={m.id} className="whitespace-pre-wrap">
                <span className="text-cyan-500">[{m.time}]</span>
                <span className="text-cyan-400 font-bold ml-2">
                  {m.type === 'user' ? 'YOU' : m.type === 'assistant' ? 'SAGE' : 'SYSTEM'}:
                </span>
                <span className="ml-2 text-cyan-300">{m.content}</span>
              </div>
            ))}
            {activeTranscript && (
              <div className="italic text-cyan-500 animate-pulse">
                <span className="text-cyan-400">[{new Date().toLocaleTimeString()}] {activeTranscript.role.toUpperCase()}:</span>
                <span className="ml-2">{activeTranscript.text}</span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Start Button */}
      <button 
        onClick={toggleCall}
        disabled={isLoading}
        className="bg-black text-cyan-400 border-2 border-cyan-400 px-6 py-3 font-[VT323] text-xl rounded-lg cursor-pointer transition-colors duration-300 hover:bg-cyan-950 disabled:opacity-50 disabled:cursor-not-allowed mt-5"
      >
        {isLoading ? 'CONNECTING...' : isActive ? 'END CALL' : 'START VOICE CHAT'}
      </button>

      {/* Error Display */}
      {error && (
        <div className="w-full max-w-3xl mt-6 p-4 border border-red-400 rounded-md bg-red-900/20 text-red-300">
          <p className="font-bold">[ ERROR ]</p>
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}

export default App