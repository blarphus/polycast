import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import LanguageSelectorScreen from './components/LanguageSelectorScreen.jsx';
import './index.css'

function Main() {
  const [selectedLanguages, setSelectedLanguages] = useState(null);

  if (!selectedLanguages) {
    return <LanguageSelectorScreen onLanguageSelected={setSelectedLanguages} />;
  } else {
    return <App targetLanguages={selectedLanguages} />;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>,
)
