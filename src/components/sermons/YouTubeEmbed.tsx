export default function YouTubeEmbed({ youtubeId, title }: { youtubeId: string; title: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-subtle">
      <iframe
        className="aspect-video w-full"
        src={`https://www.youtube.com/embed/${youtubeId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  )
}
