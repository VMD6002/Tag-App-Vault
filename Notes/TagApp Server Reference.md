## Media Folder Structure

```
media
├── Gallaries
│   ├── <Gallery Name>
│   │   ├── .gallery-covers
│   │   │   ├── cover.<content name>.<ext>
│   │   │   └── ...cover files
│   │   │
│   │   ├── <content name>.<ext> ( video / img )
│   │   └── ...contents
│   │
│   └── ...gallaries
│
├── Audios
│   ├── <Audio Group Name>
│   │   ├── .audio-covers
│   │   │   ├── cover.<audio name>.<ext>
│   │   │   └── ...cover files
│   │   │
│   │   ├── <audio name>.<ext>
│   │   └── ...audios
│   │
│   └── ...audio groups
│
├── Texts
│   ├── <Text Group Name>
│   │   ├── .media
│   │   │   ├── <content name>.<ext>
│   │   │   └── ...contents
│   │   │
│   │   ├── <text name>.md
│   │   └── ...texts
│   │
│   └── ...text groups
│
├── Images
│   ├── .covers
│   │   ├── cover.<image name>.<ext>
│   │   └── ...image cover files
│   │
│   ├── <image name>.<ext>
│   └── ...images
│
└── Videos
    ├── .covers
    │   ├── cover.<video name>.<ext>
    │   └── ...video cover files
    ├── .captions
    │   ├── cover.<video name>.vtt
    │   └── ...video caption files
    │
    ├── <video name>.<ext>
    └── ...videos
```

### Image & Video Structure

content = videos or image

```
Images / Videos
├── .covers
│   ├── cover.<content name>.<ext>
│   └── ...content cover files
│
├── <content name>.<ext>
└── ...contents
```

Note: Video has the extra

```
.captions
├── cover.<video name>.vtt
└── ...video caption files
```

### Gallery / Audio Structure

Note: .audio-covers and .gallery-covers used in place .covers to avoid Caddy config setup for .covers

```
Audios / Galleries
├── <Audio-List / Gallery Name>
│   ├── .(audio / gallery)-covers
│   │   ├── cover.<content name>.<ext>
│   │   └── ...cover files
│   │
│   ├── <content name>.<ext>
│   └── ...contents
│
└── ...audio groups
```

### Text Structure

```
Texts
├── <Text Group Name>
│   ├── .media
│   │   ├── <content name>.<ext>
│   │   └── ...contents
│   │
│   ├── <text name>.md
│   └── ...texts
│
└── ...text groups
```

## Sync Folder Structure

```
Sync
├── <Gallery Name>.gallery
│   ├── .gallery-covers
│   │   ├── cover.<content name>.<ext>
│   │   └── ...cover files
│   │
│   ├── <content name>.<ext>
│   └── ...contents
|
├── <Audio List Name>.audio
│   ├── .audio-covers
│   │   ├── cover.<content name>.<ext>
│   │   └── ...cover files
│   │
│   ├── <audio name>.<ext>
│   └── ...audios
│
├── <Text>.txt
│   ├── .media
│   │   ├── <content name>.<ext>
│   │   └── ...contents
│   │
│   ├── <text name>.md
│   └── ...texts
│
├── cover.<image / video name>.<ext>
├── ...image/video cover files
├── <image / video name>.<ext>
└── ...image/video files
```
