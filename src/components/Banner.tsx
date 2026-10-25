import type { BannerInfo } from "@/lib/offseason";

export default function Banner({ info, onGo }: { info: BannerInfo; onGo: (date: string) => void }) {
  return (
    <section className="banner" aria-label={info.tag}>
      <span className="tag">{info.tag.toUpperCase()}</span>
      <div className="msg">
        <b>{info.title}</b> {info.detail}
        {info.note && <em>{info.note}</em>}
      </div>
      {info.action && (
        <button type="button" onClick={() => onGo(info.action!.date)}>
          {info.action.label}
        </button>
      )}
    </section>
  );
}
