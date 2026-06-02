import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  CallStatus,
  JoinCallParams,
  SignalingMessage,
  UseWebRTCReturn,
} from '../types/webrtc'

const SIGNALING_URL = 'ws://localhost:8080/ws'

const PEER_CONNECTION_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function createEmptyMediaStream(): MediaStream {
  return new MediaStream()
}

export function useWebRTC(): UseWebRTCReturn {
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const websocketRef = useRef<WebSocket | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream>(createEmptyMediaStream())
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const remotePeerIdRef = useRef('')
  const peerIdRef = useRef('')
  const roomIdRef = useRef('')

  const [status, setStatus] = useState<CallStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [peerId, setPeerId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [remotePeerId, setRemotePeerId] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  const setRemotePeer = useCallback((nextPeerId?: string) => {
    if (!nextPeerId) {
      return
    }

    remotePeerIdRef.current = nextPeerId
    setRemotePeerId(nextPeerId)
  }, [])

  const attachLocalStream = useCallback((stream: MediaStream | null) => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream
    }
  }, [])

  const attachRemoteStream = useCallback((stream: MediaStream | null) => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream
    }
  }, [])

  const sendMessage = useCallback(
    (message: Omit<SignalingMessage, 'roomId'>) => {
      const websocket = websocketRef.current

      if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        setError('Signaling socket is not connected.')
        return
      }

      const targetPeerId = remotePeerIdRef.current
      const payload: SignalingMessage = {
        ...message,
        roomId: roomIdRef.current,
        ...(targetPeerId ? { to: targetPeerId } : {}),
      }

      websocket.send(JSON.stringify(payload))
    },
    [],
  )

  const getOrCreatePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current
    }

    const peerConnection = new RTCPeerConnection(PEER_CONNECTION_CONFIG)
    const remoteStream = remoteStreamRef.current

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({
          type: 'ice-candidate',
          data: event.candidate.toJSON(),
        })
      }
    }

    peerConnection.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        if (!remoteStream.getTracks().some((item) => item.id === track.id)) {
          remoteStream.addTrack(track)
        }
      })

      attachRemoteStream(remoteStream)
      setStatus('connected')
    }

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        setStatus('connected')
      }

      if (
        peerConnection.connectionState === 'failed' ||
        peerConnection.connectionState === 'disconnected'
      ) {
        setError(`Peer connection ${peerConnection.connectionState}.`)
      }
    }

    localStreamRef.current?.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStreamRef.current as MediaStream)
    })

    peerConnectionRef.current = peerConnection
    return peerConnection
  }, [attachRemoteStream, sendMessage])

  const cleanupPeerConnection = useCallback(() => {
    peerConnectionRef.current?.getSenders().forEach((sender) => {
      peerConnectionRef.current?.removeTrack(sender)
    })
    peerConnectionRef.current?.close()
    peerConnectionRef.current = null

    remoteStreamRef.current.getTracks().forEach((track) => track.stop())
    remoteStreamRef.current = createEmptyMediaStream()
    attachRemoteStream(null)
  }, [attachRemoteStream])

  const stopLocalStreams = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    cameraStreamRef.current = null
    attachLocalStream(null)
  }, [attachLocalStream])

  const cleanupResources = useCallback(() => {
    websocketRef.current?.close()
    websocketRef.current = null
    cleanupPeerConnection()
    stopLocalStreams()
  }, [cleanupPeerConnection, stopLocalStreams])

  const endCall = useCallback(() => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      sendMessage({ type: 'leave' })
    }

    cleanupResources()

    remotePeerIdRef.current = ''
    peerIdRef.current = ''
    roomIdRef.current = ''
    setRemotePeerId('')
    setPeerId('')
    setRoomId('')
    setIsMuted(false)
    setIsCameraOff(false)
    setIsScreenSharing(false)
    setStatus('ended')
  }, [cleanupResources, sendMessage])

  const handleOffer = useCallback(
    async (message: SignalingMessage<RTCSessionDescriptionInit>) => {
      try {
        setRemotePeer(message.from)

        if (!message.data) {
          throw new Error('Received an offer without session data.')
        }

        const peerConnection = getOrCreatePeerConnection()
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(message.data),
        )

        const answer = await peerConnection.createAnswer()
        await peerConnection.setLocalDescription(answer)

        sendMessage({
          type: 'answer',
          data: answer,
        })

        setStatus('connected')
      } catch (nextError) {
        setError(`Could not handle offer: ${getErrorMessage(nextError)}`)
        setStatus('error')
      }
    },
    [getOrCreatePeerConnection, sendMessage, setRemotePeer],
  )

  const handleAnswer = useCallback(
    async (message: SignalingMessage<RTCSessionDescriptionInit>) => {
      try {
        setRemotePeer(message.from)

        if (!message.data) {
          throw new Error('Received an answer without session data.')
        }

        const peerConnection = getOrCreatePeerConnection()
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(message.data),
        )

        setStatus('connected')
      } catch (nextError) {
        setError(`Could not handle answer: ${getErrorMessage(nextError)}`)
        setStatus('error')
      }
    },
    [getOrCreatePeerConnection, setRemotePeer],
  )

  const handleIceCandidate = useCallback(
    async (message: SignalingMessage<RTCIceCandidateInit>) => {
      try {
        setRemotePeer(message.from)

        if (!message.data) {
          return
        }

        const peerConnection = getOrCreatePeerConnection()
        await peerConnection.addIceCandidate(new RTCIceCandidate(message.data))
      } catch (nextError) {
        setError(`Could not add ICE candidate: ${getErrorMessage(nextError)}`)
      }
    },
    [getOrCreatePeerConnection, setRemotePeer],
  )

  const handleSignalingMessage = useCallback(
    async (event: MessageEvent<string>) => {
      try {
        const message = JSON.parse(event.data) as SignalingMessage

        switch (message.type) {
          case 'peer-joined':
            setRemotePeer(message.from)
            setStatus('joined')
            break
          case 'peer-left':
          case 'leave':
            if (message.from === remotePeerIdRef.current) {
              remotePeerIdRef.current = ''
              setRemotePeerId('')
              cleanupPeerConnection()
            }
            setStatus('joined')
            break
          case 'offer':
            await handleOffer(message as SignalingMessage<RTCSessionDescriptionInit>)
            break
          case 'answer':
            await handleAnswer(message as SignalingMessage<RTCSessionDescriptionInit>)
            break
          case 'ice-candidate':
            await handleIceCandidate(message as SignalingMessage<RTCIceCandidateInit>)
            break
          case 'error':
            setError(
              typeof message.data === 'string'
                ? message.data
                : 'The signaling server returned an error.',
            )
            setStatus('error')
            break
          default:
            break
        }
      } catch (nextError) {
        setError(`Invalid signaling message: ${getErrorMessage(nextError)}`)
        setStatus('error')
      }
    },
    [
      cleanupPeerConnection,
      handleAnswer,
      handleIceCandidate,
      handleOffer,
      setRemotePeer,
    ],
  )

  const joinRoom = useCallback(
    async ({ peerId: nextPeerId, roomId: nextRoomId }: JoinCallParams) => {
      const trimmedPeerId = nextPeerId.trim()
      const trimmedRoomId = nextRoomId.trim()

      if (!trimmedPeerId || !trimmedRoomId) {
        setError('Peer ID and Room ID are required.')
        setStatus('error')
        return
      }

      try {
        setStatus('joining')
        setError(null)
        cleanupPeerConnection()
        stopLocalStreams()
        websocketRef.current?.close()

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        })

        localStreamRef.current = stream
        cameraStreamRef.current = stream
        attachLocalStream(stream)
        setIsMuted(false)
        setIsCameraOff(false)
        setIsScreenSharing(false)

        const websocketUrl = new URL(SIGNALING_URL)
        websocketUrl.searchParams.set('peerId', trimmedPeerId)
        websocketUrl.searchParams.set('roomId', trimmedRoomId)

        const websocket = new WebSocket(websocketUrl.toString())
        websocketRef.current = websocket

        websocket.onopen = () => {
          peerIdRef.current = trimmedPeerId
          roomIdRef.current = trimmedRoomId
          setPeerId(trimmedPeerId)
          setRoomId(trimmedRoomId)
          setStatus('joined')
        }

        websocket.onmessage = handleSignalingMessage

        websocket.onerror = () => {
          setError('Could not connect to the signaling server.')
          setStatus('error')
        }

        websocket.onclose = () => {
          if (status !== 'ended') {
            setStatus((currentStatus) =>
              currentStatus === 'idle' ? 'idle' : 'ended',
            )
          }
        }
      } catch (nextError) {
        stopLocalStreams()
        setError(`Could not join room: ${getErrorMessage(nextError)}`)
        setStatus('error')
      }
    },
    [
      attachLocalStream,
      cleanupPeerConnection,
      handleSignalingMessage,
      status,
      stopLocalStreams,
    ],
  )

  const startCall = useCallback(async () => {
    try {
      setError(null)

      if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
        throw new Error('Join a room before starting a call.')
      }

      const peerConnection = getOrCreatePeerConnection()
      setStatus('calling')

      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)

      sendMessage({
        type: 'offer',
        data: offer,
      })
    } catch (nextError) {
      setError(`Could not start call: ${getErrorMessage(nextError)}`)
      setStatus('error')
    }
  }, [getOrCreatePeerConnection, sendMessage])

  const toggleMicrophone = useCallback(() => {
    const audioTracks = localStreamRef.current?.getAudioTracks() ?? []
    const shouldMute = audioTracks.some((track) => track.enabled)

    audioTracks.forEach((track) => {
      track.enabled = !shouldMute
    })

    setIsMuted(shouldMute)
  }, [])

  const toggleCamera = useCallback(() => {
    const videoTracks = cameraStreamRef.current?.getVideoTracks() ?? []
    const shouldDisableCamera = videoTracks.some((track) => track.enabled)

    videoTracks.forEach((track) => {
      track.enabled = !shouldDisableCamera
    })

    setIsCameraOff(shouldDisableCamera)
  }, [])

  const replaceOutgoingVideoTrack = useCallback((nextTrack: MediaStreamTrack) => {
    const sender = peerConnectionRef.current
      ?.getSenders()
      .find((item) => item.track?.kind === 'video')

    void sender?.replaceTrack(nextTrack)
  }, [])

  const shareScreen = useCallback(async () => {
    try {
      setError(null)

      if (!navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen sharing is not supported in this browser.')
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      })
      const screenTrack = displayStream.getVideoTracks()[0]

      if (!screenTrack) {
        throw new Error('No screen video track was selected.')
      }

      replaceOutgoingVideoTrack(screenTrack)

      const audioTracks = localStreamRef.current?.getAudioTracks() ?? []
      const mixedStream = new MediaStream([screenTrack, ...audioTracks])
      localStreamRef.current = mixedStream
      attachLocalStream(mixedStream)
      setIsScreenSharing(true)

      screenTrack.onended = () => {
        const cameraTrack = cameraStreamRef.current?.getVideoTracks()[0]

        if (cameraTrack) {
          replaceOutgoingVideoTrack(cameraTrack)
          localStreamRef.current = cameraStreamRef.current
          attachLocalStream(cameraStreamRef.current)
        }

        setIsScreenSharing(false)
      }
    } catch (nextError) {
      setError(`Could not share screen: ${getErrorMessage(nextError)}`)
    }
  }, [attachLocalStream, replaceOutgoingVideoTrack])

  useEffect(() => {
    attachLocalStream(localStreamRef.current)
    attachRemoteStream(remoteStreamRef.current)
  }, [attachLocalStream, attachRemoteStream])

  useEffect(() => cleanupResources, [cleanupResources])

  return {
    localVideoRef,
    remoteVideoRef,
    status,
    error,
    peerId,
    roomId,
    remotePeerId,
    isJoined: status === 'joined' || status === 'calling' || status === 'connected',
    isMuted,
    isCameraOff,
    isScreenSharing,
    joinRoom,
    startCall,
    toggleMicrophone,
    toggleCamera,
    shareScreen,
    endCall,
  }
}
