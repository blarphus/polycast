import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './ImageBackground.css';

/**
 * Component to display an AI-generated image as a background
 */
const ImageBackground = ({ show }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    // Only fetch the image when the component is shown
    if (show) {
      const fetchImage = async () => {
        try {
          setIsLoading(true);
          setError(null);
          setDebugInfo(null);
          
          const prompt = 'A detailed photo of a colorful iguana in its natural habitat, full body shot';
          console.log(`Requesting image with prompt: "${prompt}"`);
          
          const apiUrl = `https://polycast-server.onrender.com/api/generate-image?prompt=${encodeURIComponent(prompt)}&quality=standard`;
          console.log(`Fetching from URL: ${apiUrl}`);
          
          const response = await fetch(apiUrl);
          
          // Store debug info about the response
          const responseDebug = {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
          };
          setDebugInfo(responseDebug);
          console.log('Response details:', responseDebug);
          
          if (!response.ok) {
            throw new Error(`Error: ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json();
          console.log('Received image data:', data);
          
          if (!data.url) {
            throw new Error('No image URL in response');
          }
          
          setImageUrl(data.url);
        } catch (err) {
          console.error('Failed to fetch image:', err);
          setError(`Failed to load image: ${err.message}`);
        } finally {
          setIsLoading(false);
        }
      };

      fetchImage();
    }
  }, [show]);

  if (!show) return null;

  return (
    <div className="image-background">
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Generating iguana image...</p>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
          {debugInfo && (
            <details>
              <summary>Debug Info</summary>
              <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
      
      {imageUrl && (
        <div className="image-container">
          <img 
            src={imageUrl} 
            alt="AI-generated iguana" 
            className="background-image"
            onLoad={() => console.log('Image loaded successfully')}
            onError={(e) => {
              console.error('Image failed to load:', e);
              setError(`Image failed to load. URL: ${imageUrl}`);
            }}
          />
        </div>
      )}
    </div>
  );
};

ImageBackground.propTypes = {
  show: PropTypes.bool.isRequired
};

export default ImageBackground;
