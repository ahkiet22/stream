import type { RefObject } from 'react'

export type SignalingEventType =
  | 'peer-joined'
  | 'peer-left'
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'leave'
  | 'error'

export interface SignalingMessage<TData = unknown> {
  type: SignalingEventType
  roomId?: string
  from?: string
  to?: string
  data?: TData
}

export interface JoinCallParams {
  peerId: string
  roomId: string
}

export type CallStatus =
  | 'idle'
  | 'joining'
  | 'joined'
  | 'calling'
  | 'connected'
  | 'ended'
  | 'error'

export interface UseWebRTCReturn {
  localVideoRef: RefObject<HTMLVideoElement | null>
  remoteVideoRef: RefObject<HTMLVideoElement | null>
  status: CallStatus
  error: string | null
  peerId: string
  roomId: string
  remotePeerId: string
  isJoined: boolean
  isMuted: boolean
  isCameraOff: boolean
  isScreenSharing: boolean
  joinRoom: (params: JoinCallParams) => Promise<void>
  startCall: () => Promise<void>
  toggleMicrophone: () => void
  toggleCamera: () => void
  shareScreen: () => Promise<void>
  endCall: () => void
}
