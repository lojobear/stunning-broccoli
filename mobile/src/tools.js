export const TOOLS = [
  { id: 'autopilot', name: 'Auto Enhance', icon: 'sparkles-outline', blurb: 'Runs a fully local cleanup chain for exposure, noise and edge detail.', control: 'strength', available: true, engine: 'LOCAL' },
  { id: 'smart_enhance', name: 'Smart Enhance', icon: 'color-wand-outline', blurb: 'One-tap local cleanup and detail recovery with no upload.', control: 'strength', available: true, engine: 'LOCAL' },
  { id: 'unblur', name: 'Unblur', icon: 'eye-outline', blurb: 'Recovers edge contrast in soft or slightly blurred images on-device.', control: 'strength', available: true, engine: 'LOCAL' },
  { id: 'sharpen', name: 'Sharpen', icon: 'aperture-outline', blurb: 'Adds local detail with adjustable strength.', control: 'strength', available: true, engine: 'LOCAL' },
  { id: 'sharpen_auto', name: 'Sharpen Auto', icon: 'scan-outline', blurb: 'Applies a balanced automatic sharpening amount.', control: null, available: true, engine: 'LOCAL' },
  { id: 'denoise', name: 'Denoise', icon: 'moon-outline', blurb: 'Reduces grain locally while retaining edge contrast.', control: 'strength', available: true, engine: 'LOCAL' },
  { id: 'denoise_auto', name: 'Denoise Auto', icon: 'analytics-outline', blurb: 'Runs a balanced automatic local denoise pass.', control: null, available: true, engine: 'LOCAL' },
  { id: 'denoise_max', name: 'Denoise Max', icon: 'cloudy-night-outline', blurb: 'Aggressive local cleanup for high-noise images.', control: 'strength', available: true, engine: 'LOCAL' },
  { id: 'relight', name: 'Relight', icon: 'sunny-outline', blurb: 'Corrects underexposure, overexposure and low contrast entirely on-device.', control: 'lighting', available: true, engine: 'LOCAL' },
  { id: 'upscale', name: 'AI Upscale', icon: 'resize-outline', blurb: 'Uses an ESRGAN neural network on your Android device. Images never leave the phone.', control: 'scale', available: true, engine: 'LOCAL AI' },
  { id: 'restore', name: 'Photo Restoration', icon: 'images-outline', blurb: 'Combines local denoise, exposure recovery and sharpening for older photos.', control: 'strength', available: true, engine: 'LOCAL' },
  { id: 'face', name: 'Face Enhancer', icon: 'person-circle-outline', blurb: 'A dedicated offline face-restoration model is being added next.', control: 'strength', available: false, engine: 'COMING' },
  { id: 'creative_upscale', name: 'Creative Upscale', icon: 'brush-outline', blurb: 'Generative enlargement needs a larger offline model and is not enabled yet.', control: 'creativity', available: false, engine: 'COMING' },
  { id: 'background', name: 'Background Remover', icon: 'cut-outline', blurb: 'Generic offline segmentation is being added as a separate local model.', control: null, available: false, engine: 'COMING' },
  { id: 'colorize', name: 'Colorizer', icon: 'color-palette-outline', blurb: 'True AI photo colorization requires another offline model and is not enabled yet.', control: 'strength', available: false, engine: 'COMING' },
  { id: 'creative_detail', name: 'Creative Detail', icon: 'planet-outline', blurb: 'Generative detail recovery is planned as an optional local model.', control: 'creativity', available: false, engine: 'COMING' }
];
