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

  useEffect(() => {
    // Only fetch the image when the component is shown
    if (show) {
      const fetchImage = async () => {
        try {
          setIsLoading(true);
          setError(null);
          
          const prompt = 'A detailed photo of a colorful iguana in its natural habitat, full body shot';
          const response = await fetch(`https://polycast-server.onrender.com/api/generate-image?prompt=${encodeURIComponent(prompt)}&quality=standard`);
          
          if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
          }
          
          const data = await response.json();
          setImageUrl(data.url);
        } catch (err) {
          console.error('Failed to fetch image:', err);
          setError('Failed to load image. Please try again later.');
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
          {error}
        </div>
      )}
      
      {imageUrl && (
        <div className="image-container">
          <img 
            src={imageUrl} 
            alt="AI-generated iguana" 
            className="background-image"
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
