# Original media fixture

`red-green-tone.webm` is an original test recording created for Luno Animate: 1 second, 128×72 pixels, 12 FPS, red then green, with a 440 Hz mono tone at 48 kHz. It contains VP8 video and Opus audio and is 9,782 bytes. There is no third-party footage or soundtrack.

It was generated with Mediabunny's browser CanvasSource/AudioBufferSource and a WebM output. Browser and packaged-Electron acceptance tests decode the actual file (not a mocked importer), verify embedded proxy/audio edits and portable saves, and decode exported MP4 pixels and non-silent audio. Keep this small fixture checked in so CI does not need network media or FFmpeg.
