import Image from "next/image";
import { BookOpen, GitBranch } from "lucide-react";

import { InteractiveDotField } from "@/components/interactive-dot-field";
import { ProfileIntroduction } from "@/components/profile-introduction";
import { ProfileJourney } from "@/components/profile-journey";
import { ProfileTransitionBridge } from "@/components/profile-transition-bridge";
import { MobileSectionNavigation, type SiteSection } from "@/components/site-section-navigation";
import { ThemeToggle } from "@/components/theme-toggle";

const profileCopy = [
  "十余年项目开发经验，横跨 Java、Python、TypeScript 与前端；从业务平台、云服务到企业 AI，一直在做需要长期负责的工程系统。",
  "现在关心 AI 如何进入真实工作，Web 如何成为新的创造界面，以及系统如何经得起长期使用。",
  "这里记录正在构建的东西，以及那些值得继续拆解的工程问题。",
];

const profileCopyEnglish = [
  "With more than a decade in project development across Java, Python, TypeScript, and frontend work, I have built engineering systems meant to be owned for the long term—from business platforms and cloud services to enterprise AI.",
  "I care about how AI enters real work, how the web becomes a new creative interface, and how systems remain useful over time.",
  "This is where I document what I am building and the engineering problems worth continuing to unpack.",
];

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
            <h1 id="profile-name">陈远</h1>
            <p>@defulat-coder</p>
          </div>

          <nav aria-label="外部链接" className="curation-home__external-links">
            <a href="https://github.com/defulat-coder" rel="noreferrer" target="_blank">
              <GitBranch aria-hidden="true" />
              GitHub
            </a>
            <a href="https://www.yuque.com/defulat-coder" rel="noreferrer" target="_blank">
              <BookOpen aria-hidden="true" />
              语雀
            </a>
          </nav>
        </div>
      </div>

      {mobileSection ? <MobileSectionNavigation current={mobileSection} /> : null}

      <InteractiveDotField />

      <ProfileIntroduction
        animateOnFirstHomeVisit={animateOnFirstHomeVisit}
        englishParagraphs={profileCopyEnglish}
        paragraphs={profileCopy}
      />

      <ProfileJourney />
    </aside>
  );
}
