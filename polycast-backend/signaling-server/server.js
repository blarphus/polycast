const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for active calls and online profiles
const activeCalls = new Map(); // callId -> { callerSocketId, calleeSocketId, callerProfile, calleeProfile }
const socketProfiles = new Map(); // socketId -> profile info
const onlineProfiles = new Map(); // profile -> socketId
const profileSockets = new Map(); // profile -> socketId (for quick lookup)

const PORT = process.env.PORT || 3002;

// Utility function to generate unique call IDs
function generateCallId() {
  return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Broadcast online profiles to all connected clients
function broadcastOnlineProfiles() {
  const profiles = Array.from(onlineProfiles.keys());
  console.log(`📢 Broadcasting online profiles: ${profiles.join(', ')}`);
  io.emit('online-profiles-updated', { profiles });
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`📞 New connection: ${socket.id}`);

  // Handle client profile registration
  socket.on('register-profile', (data) => {
    console.log(`👤 Profile registered: ${data.profile} (${socket.id})`);
    
    // Remove any existing registration for this profile
    const existingSocketId = profileSockets.get(data.profile);
    if (existingSocketId && existingSocketId !== socket.id) {
      console.log(`👤 Profile ${data.profile} already registered on ${existingSocketId}, removing old registration`);
      socketProfiles.delete(existingSocketId);
      onlineProfiles.delete(data.profile);
    }
    
    // Register the profile
    socketProfiles.set(socket.id, {
      profile: data.profile,
      nativeLanguage: data.nativeLanguage,
      targetLanguage: data.targetLanguage
    });
    
    // Track profile as online
    onlineProfiles.set(data.profile, socket.id);
    profileSockets.set(data.profile, socket.id);
    
    console.log(`✅ Profile ${data.profile} is now online. Total online: ${onlineProfiles.size}`);
    
    // Broadcast updated online profiles to all clients
    broadcastOnlineProfiles();
  });

  // Handle getting online profiles (for dropdown)
  socket.on('get-online-profiles', () => {
    const profiles = Array.from(onlineProfiles.keys());
    const currentProfile = socketProfiles.get(socket.id)?.profile;
    // Exclude the requester's own profile
    const otherProfiles = profiles.filter(p => p !== currentProfile);
    socket.emit('online-profiles', { profiles: otherProfiles });
  });

  // Handle calling another profile
  socket.on('call-profile', (data) => {
    const { targetProfile } = data;
    const callerProfile = socketProfiles.get(socket.id)?.profile;
    
    if (!callerProfile) {
      socket.emit('call-error', { message: 'Profile not registered' });
      return;
    }
    
    const targetSocketId = profileSockets.get(targetProfile);
    if (!targetSocketId) {
      socket.emit('call-error', { message: 'Target profile not online' });
      return;
    }
    
    const callId = generateCallId();
    console.log(`📞 ${callerProfile} calling ${targetProfile} (call: ${callId})`);
    
    // Store the pending call
    activeCalls.set(callId, {
      callerSocketId: socket.id,
      calleeSocketId: targetSocketId,
      callerProfile: callerProfile,
      calleeProfile: targetProfile,
      status: 'ringing'
    });
    
    // Send incoming call notification to target
    io.to(targetSocketId).emit('incoming-call', {
      callId: callId,
      callerProfile: callerProfile
    });
    
    // Confirm call initiated to caller
    socket.emit('call-initiated', {
      callId: callId,
      targetProfile: targetProfile
    });
  });

  // Handle accepting a call
  socket.on('accept-call', (data) => {
    const { callId } = data;
    const call = activeCalls.get(callId);
    
    if (!call || call.calleeSocketId !== socket.id) {
      socket.emit('call-error', { message: 'Invalid call' });
      return;
    }
    
    console.log(`✅ ${call.calleeProfile} accepted call from ${call.callerProfile}`);
    
    // Update call status
    call.status = 'accepted';
    
    // Notify both parties that call was accepted
    io.to(call.callerSocketId).emit('call-accepted', {
      callId: callId,
      calleeProfile: call.calleeProfile
    });
    
    io.to(call.calleeSocketId).emit('call-accepted', {
      callId: callId,
      callerProfile: call.callerProfile
    });
  });

  // Handle rejecting a call
  socket.on('reject-call', (data) => {
    const { callId } = data;
    const call = activeCalls.get(callId);
    
    if (!call || call.calleeSocketId !== socket.id) {
      socket.emit('call-error', { message: 'Invalid call' });
      return;
    }
    
    console.log(`❌ ${call.calleeProfile} rejected call from ${call.callerProfile}`);
    
    // Notify caller that call was rejected
    io.to(call.callerSocketId).emit('call-rejected', {
      callId: callId,
      calleeProfile: call.calleeProfile
    });
    
    // Remove the call
    activeCalls.delete(callId);
  });

  // Handle ending a call
  socket.on('end-call', (data) => {
    const { callId } = data;
    const call = activeCalls.get(callId);
    
    if (!call) {
      return; // Call already ended
    }
    
    console.log(`📞 Call ended: ${call.callerProfile} <-> ${call.calleeProfile}`);
    
    // Notify both parties
    io.to(call.callerSocketId).emit('call-ended', { callId: callId });
    io.to(call.calleeSocketId).emit('call-ended', { callId: callId });
    
    // Remove the call
    activeCalls.delete(callId);
  });

  // Legacy host-call handler (to be removed)
  socket.on('host-call', (data) => {
    // For backward compatibility, still generate a code
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    const profileInfo = socketProfiles.get(socket.id);
    
    activeCalls.set(code, {
      hostSocketId: socket.id,
      hostProfile: profileInfo?.profile || 'Unknown',
      hostLanguages: {
        native: profileInfo?.nativeLanguage || 'English',
        target: profileInfo?.targetLanguage || 'Spanish'
      },
      joiners: [],
      createdAt: Date.now()
    });

    console.log(`🏠 Call hosted: ${code} by ${profileInfo?.profile || socket.id}`);
    socket.emit('call-hosted', { 
      code,
      hostProfile: profileInfo?.profile || 'Unknown'
    });
  });

  // Handle joining an existing call
  socket.on('join-call', (data) => {
    const callInfo = activeCalls.get(data.code);
    const joinerProfile = socketProfiles.get(socket.id);
    
    if (callInfo) {
      // Add joiner to the call
      callInfo.joiners.push({
        socketId: socket.id,
        profile: joinerProfile?.profile || 'Unknown',
        joinedAt: Date.now()
      });

      console.log(`🤝 ${joinerProfile?.profile || socket.id} joining call ${data.code}`);
      
      // Notify host about the joiner
      socket.to(callInfo.hostSocketId).emit('call-join-request', {
        joinerSocketId: socket.id,
        joinerProfile: joinerProfile?.profile || 'Unknown',
        callCode: data.code
      });

      // Notify joiner that call was found
      socket.emit('call-found', {
        hostSocketId: callInfo.hostSocketId,
        hostProfile: callInfo.hostProfile,
        callCode: data.code
      });
    } else {
      console.log(`❌ Call not found: ${data.code}`);
      socket.emit('call-not-found', { code: data.code });
    }
  });

  // WebRTC signaling - Forward offer from joiner to host
  socket.on('webrtc-offer', (data) => {
    console.log(`📡 Forwarding offer from ${socket.id} to ${data.targetSocketId}`);
    socket.to(data.targetSocketId).emit('webrtc-offer', {
      offer: data.offer,
      callerSocketId: socket.id
    });
  });

  // WebRTC signaling - Forward answer from host to joiner
  socket.on('webrtc-answer', (data) => {
    console.log(`📡 Forwarding answer from ${socket.id} to ${data.targetSocketId}`);
    socket.to(data.targetSocketId).emit('webrtc-answer', {
      answer: data.answer,
      answererSocketId: socket.id
    });
  });

  // WebRTC signaling - Forward ICE candidates
  socket.on('webrtc-ice-candidate', (data) => {
    console.log(`🧊 Forwarding ICE candidate from ${socket.id} to ${data.targetSocketId}`);
    socket.to(data.targetSocketId).emit('webrtc-ice-candidate', {
      candidate: data.candidate,
      senderSocketId: socket.id
    });
  });

  // Handle call termination
  socket.on('end-call', (data) => {
    const profileInfo = socketProfiles.get(socket.id);
    console.log(`📞 Call ended by ${profileInfo?.profile || socket.id}`);
    
    // Find and clean up the call
    for (const [code, callInfo] of activeCalls.entries()) {
      if (callInfo.hostSocketId === socket.id) {
        // Host ended the call - notify all joiners
        callInfo.joiners.forEach(joiner => {
          socket.to(joiner.socketId).emit('call-ended', {
            reason: 'Host ended the call',
            endedBy: callInfo.hostProfile
          });
        });
        activeCalls.delete(code);
        console.log(`🗑️ Call ${code} deleted (host left)`);
        break;
      } else {
        // Check if joiner left
        const joinerIndex = callInfo.joiners.findIndex(j => j.socketId === socket.id);
        if (joinerIndex >= 0) {
          const joiner = callInfo.joiners[joinerIndex];
          callInfo.joiners.splice(joinerIndex, 1);
          
          // Notify host that joiner left
          socket.to(callInfo.hostSocketId).emit('joiner-left', {
            joinerProfile: joiner.profile,
            callCode: code
          });
          console.log(`👋 ${joiner.profile} left call ${code}`);
          break;
        }
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const profileInfo = socketProfiles.get(socket.id);
    console.log(`❌ Disconnected: ${profileInfo?.profile || socket.id} (${socket.id})`);
    
    // Remove from online profiles
    if (profileInfo?.profile) {
      onlineProfiles.delete(profileInfo.profile);
      profileSockets.delete(profileInfo.profile);
      console.log(`📱 Profile ${profileInfo.profile} is now offline. Total online: ${onlineProfiles.size}`);
      broadcastOnlineProfiles();
    }
    
    // Clean up profile info
    socketProfiles.delete(socket.id);
    
    // Clean up active calls
    for (const [callId, call] of activeCalls.entries()) {
      if (call.callerSocketId === socket.id || call.calleeSocketId === socket.id) {
        // Notify the other party
        const otherSocketId = call.callerSocketId === socket.id ? call.calleeSocketId : call.callerSocketId;
        io.to(otherSocketId).emit('call-ended', { callId: callId, reason: 'Other party disconnected' });
        activeCalls.delete(callId);
        console.log(`📞 Call ${callId} ended due to disconnection`);
      }
    }
    
    // Clean up legacy calls and notify participants
    for (const [code, callInfo] of activeCalls.entries()) {
      if (callInfo.hostSocketId === socket.id) {
        // Host disconnected - end the call
        callInfo.joiners.forEach(joiner => {
          socket.to(joiner.socketId).emit('call-ended', {
            reason: 'Host disconnected',
            endedBy: callInfo.hostProfile
          });
        });
        activeCalls.delete(code);
        console.log(`🗑️ Call ${code} deleted (host disconnected)`);
      } else {
        // Check if joiner disconnected
        const joinerIndex = callInfo.joiners.findIndex(j => j.socketId === socket.id);
        if (joinerIndex >= 0) {
          const joiner = callInfo.joiners[joinerIndex];
          callInfo.joiners.splice(joinerIndex, 1);
          
          // Notify host
          socket.to(callInfo.hostSocketId).emit('joiner-left', {
            joinerProfile: joiner.profile,
            callCode: code
          });
          console.log(`👋 ${joiner.profile} disconnected from call ${code}`);
        }
      }
    }
    
    // Clean up profile info
    socketProfiles.delete(socket.id);
  });
});

// REST API endpoints for debugging/monitoring
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    activeCalls: activeCalls.size,
    connectedClients: socketProfiles.size
  });
});

app.get('/active-calls', (req, res) => {
  const calls = Array.from(activeCalls.entries()).map(([code, info]) => ({
    code,
    host: info.hostProfile,
    joiners: info.joiners.length,
    createdAt: new Date(info.createdAt).toISOString()
  }));
  
  res.json({ activeCalls: calls });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Polycast Signaling Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📞 Active calls: http://localhost:${PORT}/active-calls`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down signaling server...');
  server.close(() => {
    console.log('✅ Server shut down gracefully');
    process.exit(0);
  });
}); 