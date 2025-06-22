import { useState, useEffect, useRef } from 'react'
import { vapi } from './vapi'
import { studyBuddyAssistant } from './assistants/studyBuddy.assistant'
import { 
  Mic, MicOff, Phone, PhoneOff, MessageSquare, Volume2, Clock, Send, 
  Loader2, Sparkles, Brain, BookOpen, Timer, Settings, Users, Zap, Activity, AlertCircle 
} from 'lucide-react'

// Get API key from environment variable for validation
const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY
const VAPI_AGENT_ID = import.meta.env.VITE_VAPI_AGENT_ID

// Call status enum-like object
const CALL_STATUS = {
  INACTIVE: 'inactive',
  ACTIVE: 'active',
  LOADING: 'loading'
}

function App() {
  // Call state
  const [callStatus, setCallStatus] = useState(CALL_STATUS.INACTIVE)
  const [assistantIsSpeaking, setAssistantIsSpeaking] = useState(false)
  
  // UI state
  const [error, setError] = useState('')
  const [volumeLevel, setVolumeLevel] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  
  // Message state
  const [messages, setMessages] = useState([])
  const [activeTranscript, setActiveTranscript] = useState(null)
  const messagesEndRef = useRef(null)
  
  // Custom say functionality
  const [customSayText, setCustomSayText] = useState('')

  // Computed states
  const isLoading = callStatus === CALL_STATUS.LOADING
  const isActive = callStatus === CALL_STATUS.ACTIVE

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, activeTranscript])

  useEffect(() => {
    if (!VAPI_PUBLIC_KEY || VAPI_PUBLIC_KEY === 'your_vapi_public_key_here') {
      setError('Please add your Vapi API key to .env file')
      return
    }

    // Set up Vapi event listeners
    const onCallStart = () => {
      console.log('Call started')
      setCallStatus(CALL_STATUS.ACTIVE)
      setError('')
      addMessage('system', '📞 Call connected')
    }

    const onCallEnd = () => {
      console.log('Call ended')
      setCallStatus(CALL_STATUS.INACTIVE)
      setAssistantIsSpeaking(false)
      setVolumeLevel(0)
      setActiveTranscript(null)
      addMessage('system', '📴 Call ended')
    }

    const onSpeechStart = () => {
      console.log('Speech started')
      setAssistantIsSpeaking(true)
    }

    const onSpeechEnd = () => {
      console.log('Speech ended')
      setAssistantIsSpeaking(false)
    }

    const onVolumeLevel = (volume) => {
      setVolumeLevel(volume)
    }

    const onMessage = (message) => {
      console.log('Received message:', message)
      
      if (message.type === 'transcript') {
        if (message.transcriptType === 'partial') {
          // Handle partial transcripts separately for real-time feedback
          setActiveTranscript({
            role: message.role,
            text: message.transcript,
            timestamp: Date.now()
          })
        } else if (message.transcriptType === 'final') {
          // Add final transcript to messages
          setActiveTranscript(null)
          if (message.role === 'user') {
            addMessage('user', message.transcript)
          } else if (message.role === 'assistant') {
            addMessage('assistant', message.transcript)
          }
        }
      } else if (message.type === 'function-call') {
        addMessage('system', `🔧 Function called: ${message.functionCall.name}`)
      } else if (message.type === 'hang') {
        addMessage('system', '👋 Call ended by assistant')
      }
    }

    const onError = (error) => {
      console.error('Vapi error:', error)
      setError(error.message || 'An error occurred')
      setCallStatus(CALL_STATUS.INACTIVE)
      addMessage('system', `❌ Error: ${error.message || error}`)
    }

    // Register event listeners
    vapi.on('call-start', onCallStart)
    vapi.on('call-end', onCallEnd)
    vapi.on('speech-start', onSpeechStart)
    vapi.on('speech-end', onSpeechEnd)
    vapi.on('volume-level', onVolumeLevel)
    vapi.on('message', onMessage)
    vapi.on('error', onError)

    // Cleanup
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
    const newMessage = {
      id: Date.now(),
      type,
      content,
      time: new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }
    setMessages(prev => [...prev, newMessage])
  }

  const start = async () => {
    setCallStatus(CALL_STATUS.LOADING)
    setError('')
    addMessage('system', '🔄 Starting call...')

    try {
      // const response = await vapi.start(studyBuddyAssistant)
      const response = await vapi.start(VAPI_AGENT_ID)
      console.log('Call response:', response)
    } catch (error) {
      console.error('Failed to start call:', error)
      setError('Failed to connect. Please check your API key and internet connection.')
      setCallStatus(CALL_STATUS.INACTIVE)
    }
  }

  const stop = () => {
    setCallStatus(CALL_STATUS.LOADING)
    vapi.stop()
  }

  const toggleCall = () => {
    if (callStatus === CALL_STATUS.ACTIVE) {
      stop()
    } else if (callStatus !== CALL_STATUS.LOADING) {
      start()
    }
  }

  const toggleMute = () => {
    const newMutedState = !isMuted
    vapi.setMuted(newMutedState)
    setIsMuted(newMutedState)
    addMessage('system', newMutedState ? '🔇 Microphone muted' : '🔊 Microphone unmuted')
  }

  const sendCustomMessage = () => {
    if (!isActive || !customSayText.trim()) return
    
    try {
      vapi.say(customSayText)
      addMessage('system', `💬 Manual say: "${customSayText}"`)
      setCustomSayText('')
    } catch (error) {
      console.error('Error with manual say:', error)
      addMessage('system', `❌ Error: ${error}`)
    }
  }

  const sendAddMessage = (content) => {
    // Send a system message to the assistant
    vapi.send({
      type: "add-message",
      message: {
        role: "system",
        content: content
      }
    })
    addMessage('system', `📝 Context added: "${content}"`)
  }

  const presetMessages = [
    "Let's start a 25-minute Pomodoro session!",
    "Can you explain this concept more simply?",
    "I'm feeling overwhelmed with my studies",
    "What are some good study tips?",
    "Tell me a motivational quote",
    "Let's take a quick break"
  ]

  // Dynamic button style with audio level shadow
  const buttonShadowStyle = isActive ? {
    boxShadow: `0 0 ${20 + volumeLevel * 50}px ${10 + volumeLevel * 20}px rgba(239, 68, 68, ${0.4 + volumeLevel * 0.6})`
  } : {}

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-3xl mx-auto flex flex-col items-center bg-white/10 backdrop-blur-xl shadow-2xl rounded-3xl p-8 border border-white/20 min-h-[95vh]">
        
        {/* Enhanced Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl shadow-lg">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-6xl font-bold bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">
              SAGE
            </h1>
            <div className="p-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl shadow-lg">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>
          <p className="text-xl text-gray-300 font-medium mb-4">Your AI-powered voice assistant</p>
          
          {/* Status Bar */}
          <div className="flex items-center justify-center gap-6 bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-3 border border-white/20">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-sm text-gray-300 font-medium">
                {isLoading ? 'Connecting...' : isActive ? 'Live Session' : 'Ready to Connect'}
              </span>
            </div>
            {isActive && (
              <div className="flex items-center gap-2 text-sm text-blue-300">
                <Activity className="w-4 h-4" />
                <span>Recording</span>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Chat Area - Taller with Better Welcome */}
        <div className="w-full h-[600px] overflow-y-scroll scrollbar-hide rounded-3xl border border-white/20 shadow-inner p-6 bg-gradient-to-b from-white/5 to-white/10 backdrop-blur-sm mb-8 space-y-4">
          {messages.length === 0 && !activeTranscript ? (
            <div className="text-center text-gray-400 mt-16">
              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-10 max-w-lg mx-auto border border-white/20 shadow-2xl">
                <div className="animate-pulse mb-6">
                  <Brain className="w-24 h-24 mx-auto text-purple-300" />
                </div>
                <h3 className="text-2xl font-extrabold mb-4 text-white tracking-wide">
                  Welcome to <span className="text-purple-300">SAGE</span>!
                </h3>
                <p className="text-base text-gray-300 leading-relaxed max-w-md mx-auto">
                  Press the <span className="text-green-400 font-semibold">call</span> button below to begin your personalized AI voice session. I can help with study tips, explain concepts, or just keep you company while you focus.
                </p>
                <div className="mt-6 flex justify-center gap-3 text-sm">
                  <span className="px-4 py-1 bg-purple-500/30 text-purple-200 rounded-full font-medium">🎓 Study Help</span>
                  <span className="px-4 py-1 bg-blue-500/30 text-blue-200 rounded-full font-medium">🎙️ Voice AI</span>
                  <span className="px-4 py-1 bg-green-500/30 text-green-200 rounded-full font-medium">⚡ Real-time</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                  <div className={`max-w-[85%] px-6 py-4 rounded-3xl text-sm shadow-lg backdrop-blur-sm ${
                    message.type === 'user' ?
                      'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-purple-500/25' :
                    message.type === 'assistant' ?
                      'bg-white/20 border border-white/30 text-white shadow-white/10' :
                      'bg-gradient-to-r from-yellow-400/20 to-orange-400/20 text-yellow-200 border border-yellow-400/30'
                  }`}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-xs opacity-90">
                        {message.type === 'user' ? '👤 You' : message.type === 'assistant' ? '🤖 SAGE' : '⚡ System'}
                      </span>
                      <span className="text-xs opacity-70">{message.time}</span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  </div>
                </div>
              ))}
              
              {/* Active Transcript */}
              {activeTranscript && (
                <div className={`flex ${activeTranscript.role === 'user' ? 'justify-end' : 'justify-start'} animate-pulse`}>
                  <div className={`max-w-[85%] px-6 py-4 rounded-3xl text-sm opacity-80 backdrop-blur-sm ${
                    activeTranscript.role === 'user' 
                      ? 'bg-gradient-to-r from-purple-400 to-pink-400 text-white' 
                      : 'bg-white/15 border border-white/30 text-gray-200'
                  }`}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-xs opacity-90">
                        {activeTranscript.role === 'user' ? '👤 You' : '🤖 SAGE'}
                      </span>
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce animation-delay-100"></div>
                        <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce animation-delay-200"></div>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap italic leading-relaxed">{activeTranscript.text}</p>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Enhanced Call Button */}
        <div className="text-center">
          <button
            onClick={toggleCall}
            disabled={isLoading}
            className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 shadow-2xl border-4 ${
              isActive 
                ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 border-red-400/50 shadow-red-500/25' :
              isLoading 
                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 border-yellow-400/50 shadow-yellow-500/25' :
                'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 border-green-400/50 shadow-green-500/25'
            } text-white disabled:cursor-not-allowed`}
          >
            {isLoading ? (
              <Loader2 className="w-12 h-12 animate-spin" />
            ) : isActive ? (
              <PhoneOff className="w-12 h-12" />
            ) : (
              <Phone className="w-12 h-12" />
            )}
          </button>
          
          <p className="text-center mt-4 text-lg text-gray-300 font-semibold">
            {isLoading ? 'Connecting to SAGE...' : isActive ? 'End Session' : 'Start Voice Chat'}
          </p>
          
          {/* Quick Stats */}
          {isActive && (
            <div className="flex justify-center gap-4 mt-4 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Session Active
              </span>
              <span className="flex items-center gap-1">
                <Volume2 className="w-3 h-3" />
                {Math.round(volumeLevel * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Enhanced Error Display */}
        {error && (
          <div className="w-full mt-6 p-4 bg-red-500/20 border border-red-400/30 rounded-2xl text-red-300 shadow-lg backdrop-blur-sm animate-shake">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/30 rounded-full">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold">Connection Error</p>
                <p className="text-sm opacity-90">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App