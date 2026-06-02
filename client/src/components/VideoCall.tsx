import { type FormEvent, useState } from 'react'
import { useWebRTC } from '../hooks/useWebRTC'

function getStatusLabel(status: string): string {
  switch (status) {
    case 'idle':
      return 'Not joined'
    case 'joining':
      return 'Joining room'
    case 'joined':
      return 'Joined room'
    case 'calling':
      return 'Calling peer'
    case 'connected':
      return 'Call connected'
    case 'ended':
      return 'Call ended'
    case 'error':
      return 'Needs attention'
    default:
      return status
  }
}

export function VideoCall() {
  const [peerInput, setPeerInput] = useState('user-a')
  const [roomInput, setRoomInput] = useState('room-1')
  const {
    localVideoRef,
    remoteVideoRef,
    status,
    error,
    peerId,
    roomId,
    remotePeerId,
    isJoined,
    isMuted,
    isCameraOff,
    isScreenSharing,
    joinRoom,
    startCall,
    toggleMicrophone,
    toggleCamera,
    shareScreen,
    endCall,
  } = useWebRTC()

  const handleJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void joinRoom({ peerId: peerInput, roomId: roomInput })
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">
              WebRTC 1-1 Call
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Fiber signaling video room
            </h1>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            <span className="font-medium text-slate-100">Status:</span>{' '}
            {getStatusLabel(status)}
          </div>
        </header>

        <form
          className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={handleJoin}
        >
          <label className="flex flex-col gap-2 text-left text-sm font-medium text-slate-300">
            Peer ID
            <input
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              value={peerInput}
              onChange={(event) => setPeerInput(event.target.value)}
              placeholder="user-a"
              disabled={status === 'joining'}
            />
          </label>

          <label className="flex flex-col gap-2 text-left text-sm font-medium text-slate-300">
            Room ID
            <input
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              value={roomInput}
              onChange={(event) => setRoomInput(event.target.value)}
              placeholder="room-1"
              disabled={status === 'joining'}
            />
          </label>

          <button
            className="self-end rounded-md bg-cyan-400 px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            type="submit"
            disabled={status === 'joining'}
          >
            {isJoined ? 'Rejoin' : 'Join Room'}
          </button>
        </form>

        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div>
                <h2 className="font-semibold">Local video</h2>
                <p className="text-sm text-slate-400">
                  {peerId ? `${peerId} in ${roomId}` : 'Join to preview camera'}
                </p>
              </div>
              {isMuted ? (
                <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
                  Muted
                </span>
              ) : null}
            </div>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="aspect-video w-full bg-slate-950 object-cover"
            />
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div>
                <h2 className="font-semibold">Remote video</h2>
                <p className="text-sm text-slate-400">
                  {remotePeerId || 'Waiting for a peer'}
                </p>
              </div>
              {status === 'connected' ? (
                <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  Live
                </span>
              ) : null}
            </div>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="aspect-video w-full bg-slate-950 object-cover"
            />
          </div>
        </section>

        <section className="flex flex-wrap gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
          <button
            className="rounded-md bg-emerald-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            type="button"
            onClick={() => void startCall()}
            disabled={!isJoined || status === 'calling'}
          >
            Start Call
          </button>
          <button
            className="rounded-md bg-slate-800 px-4 py-2 font-semibold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-500"
            type="button"
            onClick={toggleMicrophone}
            disabled={!isJoined}
          >
            {isMuted ? 'Unmute Mic' : 'Mute Mic'}
          </button>
          <button
            className="rounded-md bg-slate-800 px-4 py-2 font-semibold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-500"
            type="button"
            onClick={toggleCamera}
            disabled={!isJoined || isScreenSharing}
          >
            {isCameraOff ? 'Camera On' : 'Camera Off'}
          </button>
          <button
            className="rounded-md bg-slate-800 px-4 py-2 font-semibold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-500"
            type="button"
            onClick={() => void shareScreen()}
            disabled={!isJoined || isScreenSharing}
          >
            {isScreenSharing ? 'Sharing Screen' : 'Share Screen'}
          </button>
          <button
            className="rounded-md bg-red-500 px-4 py-2 font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            type="button"
            onClick={endCall}
            disabled={!isJoined && status !== 'error'}
          >
            End Call
          </button>
        </section>
      </div>
    </main>
  )
}
