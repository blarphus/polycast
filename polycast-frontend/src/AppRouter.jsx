import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import VideoPage from './components/VideoPage';

// AppRouter is a wrapper component that handles routing
function AppRouter(props) {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App {...props} />} />
        <Route path="/video" element={<VideoPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
