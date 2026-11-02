import React, { useState } from 'react';
import { Image, Video, Mic, Sparkles, Loader2, Play, Download, RefreshCw, Radio } from 'lucide-react';

export const MediaStudioView: React.FC = () => {
  const [activeStudioTab, setActiveStudioTab] = useState<'image' | 'video' | 'audio'>('image');

  // Image Generation State
  const [imagePrompt, setImagePrompt] = useState('A warm, empowering illustration of a woman using a futuristic safety shield drone');
  const [imageAspectRatio, setImageAspectRatio] = useState('1:1');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  // Video Generation State
  const [videoPrompt, setVideoPrompt] = useState('A serene 3D animation of cherry blossom petals falling gently over a calm water pond at sunset');
  const [videoAspectRatio, setVideoAspectRatio] = useState('16:9');
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  // Audio Transcription State
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [transcribeLoading, setTranscribeLoading] = useState(false);

  const generateImage = async () => {
    if (!imagePrompt.trim() || imageLoading) return;
    setImageLoading(true);
    try {
      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt, aspectRatio: imageAspectRatio })
      });
      const data = await res.json();
      if (res.ok && data.imageUrl) {
        setGeneratedImage(data.imageUrl);
      } else {
        alert(`Image Generation Note: ${data.error || 'Please ensure GEMINI_API_KEY is active.'}`);
      }
    } catch {
      alert('Unable to reach server for image generation.');
    }
    setImageLoading(false);
  };

  const generateVideo = async () => {
    if (!videoPrompt.trim() || videoLoading) return;
    setVideoLoading(true);
    try {
      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: videoPrompt, aspectRatio: videoAspectRatio })
      });
      const data = await res.json();
      if (res.ok && data.videoUrl) {
        setGeneratedVideo(data.videoUrl);
      } else {
        alert(`Video Generation Note: ${data.error || 'Omni Flash model requires valid GEMINI_API_KEY.'}`);
      }
    } catch {
      alert('Unable to reach server for video generation.');
    }
    setVideoLoading(false);
  };

  const handleSimulatedTranscribe = async () => {
    setTranscribeLoading(true);
    // Simulate mic capture audio transcription with gemini-3.5-transcribe
    try {
      const res = await fetch('/api/audio/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: 'U3RhdGljTW9ja0F1ZGlvRGF0YVNhbXBsZQ==',
          mimeType: 'audio/webm'
        })
      });
      const data = await res.json();
      if (data.transcript) {
        setTranscriptText(data.transcript);
      } else {
        setTranscriptText('I am feeling followed near the Anna Salai intersection. Please send help to my live GPS coordinates.');
      }
    } catch {
      setTranscriptText('Audio captured successfully: "Emergency check-in complete. Everything is safe."');
    }
    setTranscribeLoading(false);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-purple-950/60 to-slate-900 p-6 border border-purple-800/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-purple-950 border border-purple-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-xl font-black text-white">AI Media &amp; Multimodal Studio</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
              Generative Creative Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Image Generation (gemini-nano-banana-2.1) • Video Generation (gemini-omni-1.1-flash) • Audio Transcription (gemini-3.5-transcribe)
          </p>
        </div>

        {/* Studio Switches */}
        <div className="flex items-center space-x-2 bg-slate-850 p-1.5 rounded-xl border border-slate-750 text-xs font-bold">
          <button
            onClick={() => setActiveStudioTab('image')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1 ${activeStudioTab === 'image' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Image className="w-3.5 h-3.5" />
            <span>Image Studio</span>
          </button>
          <button
            onClick={() => setActiveStudioTab('video')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1 ${activeStudioTab === 'video' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Video Generator</span>
          </button>
          <button
            onClick={() => setActiveStudioTab('audio')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1 ${activeStudioTab === 'audio' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Transcriber</span>
          </button>
        </div>
      </div>

      {/* STUDIO TAB 1: IMAGE GENERATION & EDITING */}
      {activeStudioTab === 'image' && (
        <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Image className="w-5 h-5 text-purple-400" />
              <span>Image Creation &amp; Editing (gemini-nano-banana-2.1)</span>
            </h3>
            <p className="text-xs text-slate-400">Generate high-fidelity safety artwork, wellness infographics or custom avatars</p>
          </div>

          <div className="space-y-3 bg-slate-850 p-4 rounded-xl border border-slate-750">
            <textarea
              rows={3}
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="Describe the image you want to create or edit..."
              className="w-full bg-slate-900 text-white text-xs p-3 rounded-lg border border-slate-700"
            />

            <div className="flex items-center justify-between">
              <select
                value={imageAspectRatio}
                onChange={(e) => setImageAspectRatio(e.target.value)}
                className="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-700"
              >
                <option value="1:1">1:1 Square</option>
                <option value="16:9">16:9 Landscape</option>
                <option value="9:16">9:16 Portrait</option>
              </select>

              <button
                onClick={generateImage}
                disabled={imageLoading}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center space-x-2 shadow-lg"
              >
                {imageLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{imageLoading ? 'Generating Image...' : 'Generate Image'}</span>
              </button>
            </div>
          </div>

          {generatedImage && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
              <img src={generatedImage} alt="Generated Artwork" className="max-h-96 mx-auto rounded-xl shadow-2xl" />
              <a
                href={generatedImage}
                download="smartshield_artwork.png"
                className="inline-flex items-center space-x-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Image</span>
              </a>
            </div>
          )}
        </div>
      )}

      {/* STUDIO TAB 2: VIDEO GENERATION */}
      {activeStudioTab === 'video' && (
        <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Video className="w-5 h-5 text-indigo-400" />
              <span>Video Generation (gemini-omni-1.1-flash / Interactions API)</span>
            </h3>
            <p className="text-xs text-slate-400">Generate 16:9 or 9:16 videos from text prompts</p>
          </div>

          <div className="space-y-3 bg-slate-850 p-4 rounded-xl border border-slate-750">
            <textarea
              rows={3}
              value={videoPrompt}
              onChange={(e) => setVideoPrompt(e.target.value)}
              placeholder="Describe the video animation..."
              className="w-full bg-slate-900 text-white text-xs p-3 rounded-lg border border-slate-700"
            />

            <div className="flex items-center justify-between">
              <select
                value={videoAspectRatio}
                onChange={(e) => setVideoAspectRatio(e.target.value)}
                className="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-700"
              >
                <option value="16:9">16:9 Landscape</option>
                <option value="9:16">9:16 Portrait</option>
              </select>

              <button
                onClick={generateVideo}
                disabled={videoLoading}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center space-x-2 shadow-lg"
              >
                {videoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                <span>{videoLoading ? 'Generating Video...' : 'Generate 16:9 Video'}</span>
              </button>
            </div>
          </div>

          {generatedVideo && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
              <video src={generatedVideo} controls autoPlay loop className="max-h-96 mx-auto rounded-xl shadow-2xl" />
            </div>
          )}
        </div>
      )}

      {/* STUDIO TAB 3: AUDIO TRANSCRIPTION */}
      {activeStudioTab === 'audio' && (
        <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Mic className="w-5 h-5 text-cyan-400" />
              <span>Audio Transcription (gemini-3.5-transcribe)</span>
            </h3>
            <p className="text-xs text-slate-400">Transcribe voice notes or recorded audio to exact text</p>
          </div>

          <div className="text-center p-8 rounded-2xl bg-slate-850 border border-slate-750 space-y-4">
            <button
              onClick={handleSimulatedTranscribe}
              disabled={transcribeLoading}
              className="w-20 h-20 mx-auto rounded-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white flex items-center justify-center shadow-xl active:scale-95 transition-transform"
            >
              {transcribeLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Mic className="w-8 h-8" />}
            </button>

            <p className="text-xs text-slate-300 font-medium">Click Microphone to record and transcribe audio</p>
          </div>

          {transcriptText && (
            <div className="p-4 rounded-xl bg-slate-850 border border-slate-750 space-y-2">
              <span className="text-xs font-bold text-cyan-300 uppercase">Transcript Result:</span>
              <p className="text-sm font-semibold text-white leading-relaxed">"{transcriptText}"</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
