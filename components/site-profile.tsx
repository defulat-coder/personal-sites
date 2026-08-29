import { BookOpen, GitBranch } from "lucide-react";
import Image from "next/image";

import { AboutPrint } from "@/components/about-print";
import { InteractiveDotField } from "@/components/interactive-dot-field";
import { ProfileIntroduction } from "@/components/profile-introduction";
import { ProfileDayVideo } from "@/components/profile-day-video";
import { ProfileTransitionBridge } from "@/components/profile-transition-bridge";
import { MobileSectionNavigation, type SiteSection } from "@/components/site-section-navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { siteProfile } from "@/config/site-profile.mjs";

type SiteProfileProps = {
  animateOnFirstHomeVisit?: boolean;
  mobileSection?: SiteSection;
};

export function SiteProfile({ animateOnFirstHomeVisit = false, mobileSection }: SiteProfileProps) {
  return (
    <aside aria-labelledby="profile-name" className="curation-home__profile">
      <ProfileTransitionBridge section={mobileSection ?? "profile"} />
      <ThemeToggle />
      <div className="curation-home__profile-header">
        <Image
          alt="参考站提供的头像插画"
          className="curation-home__avatar"
          height={105}
          priority
          src="/images/ample-avatar.png"
          width={105}
        />

        <div className="curation-home__profile-summary">
          <div className="curation-home__identity">
            <h1 id="profile-name">{siteProfile.name}</h1>
            <p>@{siteProfile.handle}</p>
          </div>

          <nav aria-label="站点链接" className="curation-home__external-links">
            <a href="https://github.com/defulat-coder" rel="noreferrer" target="_blank">
              <GitBranch aria-hidden="true" />
              GitHub
            </a>
            <a href="https://www.yuque.com/defulat-coder" rel="noreferrer" target="_blank">
              <BookOpen aria-hidden="true" />
              语雀
            </a>
            <AboutPrint />
            <ProfileDayVideo />
          </nav>
        </div>
      </div>

      {mobileSection ? <MobileSectionNavigation current={mobileSection} /> : null}

      <InteractiveDotField />

      <ProfileIntroduction
        animateOnFirstHomeVisit={animateOnFirstHomeVisit}
        englishParagraphs={siteProfile.paragraphsEnglish}
        paragraphs={siteProfile.paragraphs}
      />
    </aside>
  );
}
