<template>
  <OverlayDialog class="about-dialog" @keydown.esc="close">
    <AppBar :label="msg.settingsAboutTitle" @back="close" />

    <div class="about-content">
      <div class="icon-section">
        <img src="/icons/icon128.png" alt="TabGroup Automata" class="app-icon" />
      </div>

      <Card>
        <CardSection tight>
          <h2 class="subtitle-2">{{ msg.aboutExtensionInfo }}</h2>
        </CardSection>
        <CardSection tight ghost>
          <div class="section-body">
            <div class="info-row">
              <strong>{{ msg.aboutVersion }}</strong>
              <span>{{ version }}</span>
            </div>
            <div class="info-row">
              <strong>{{ msg.aboutAuthor }}</strong>
              <span>Zhang, Tianrong</span>
            </div>
            <div class="info-row">
              <strong>{{ msg.aboutRepository }}</strong>
              <a
                href="https://github.com/ZhangTianrong/auto-group-tabs"
                target="_blank"
                rel="noopener noreferrer"
              >
                ZhangTianrong/auto-group-tabs
              </a>
            </div>
          </div>
        </CardSection>
      </Card>

      <Card>
        <CardSection tight>
          <h2 class="subtitle-2">{{ msg.aboutHelpTitle }}</h2>
        </CardSection>
        <CardSection tight ghost>
          <div class="section-body">
            <div class="help-block">
              <h3 class="help-subtitle">{{ msg.aboutRulesExecutionTitle }}</h3>
              <p class="help-text">{{ msg.aboutRulesExecutionText }}</p>
            </div>
            <div class="help-block">
              <h3 class="help-subtitle">{{ msg.aboutSpecialRulesTitle }}</h3>
              <div class="special-rule">
                <code class="rule-code">%%ignore%%</code>
                <p class="help-text">{{ msg.aboutSpecialRuleIgnore }}</p>
              </div>
              <div class="special-rule">
                <code class="rule-code">%%domain%%</code>
                <p class="help-text">{{ msg.aboutSpecialRuleDomain }}</p>
              </div>
            </div>
            <div class="help-block">
              <h3 class="help-subtitle">{{ msg.aboutMiscConfigTitle }}</h3>
              <p class="help-text">{{ msg.aboutMiscConfigText }}</p>
            </div>
          </div>
        </CardSection>
      </Card>

      <Card>
        <CardSection tight>
          <h2 class="subtitle-2">{{ msg.aboutRelatedExtensionTitle }}</h2>
        </CardSection>
        <CardSection tight ghost>
          <div class="section-body">
            <p class="help-text">{{ msg.aboutRelatedExtensionText }}</p>
            <div class="info-row">
              <strong>{{ msg.aboutRelatedExtensionName }}</strong>
              <a
                href="https://github.com/ZhangTianrong/edge-tab-group-shortcut"
                target="_blank"
                rel="noopener noreferrer"
              >
                ZhangTianrong/edge-tab-group-shortcut
              </a>
            </div>
          </div>
        </CardSection>
      </Card>

      <Card>
        <CardSection tight>
          <h2 class="subtitle-2">{{ msg.aboutAttributionTitle }}</h2>
        </CardSection>
        <CardSection tight ghost>
          <div class="section-body">
            <div class="help-block">
              <h3 class="help-subtitle">{{ msg.aboutUpstreamRepoTitle }}</h3>
              <p class="help-text">{{ msg.aboutUpstreamRepoText }}</p>
              <a
                class="block-link"
                href="https://github.com/loilo/auto-group-tabs"
                target="_blank"
                rel="noopener noreferrer"
              >
                loilo/auto-group-tabs
              </a>
              <p class="help-text license-text">{{ msg.aboutUpstreamLicense }}</p>
            </div>
            <div class="help-block">
              <h3 class="help-subtitle">{{ msg.aboutIconSourceTitle }}</h3>
              <p class="help-text">{{ msg.aboutIconSourceText }}</p>
            </div>
          </div>
        </CardSection>
      </Card>
    </div>
  </OverlayDialog>
</template>

<script setup lang="ts">
import { inject } from 'vue'

import AppBar from '@/components/AppBar.vue'
import Card from '@/components/Card/Card.vue'
import CardSection from '@/components/Card/CardSection.vue'
import OverlayDialog from './OverlayDialog.vue'
import { Translation } from '@/util/types'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const msg = inject<Translation>('msg')!

const version = chrome.runtime.getManifest().version

function close() {
  emit('close')
}
</script>

<style lang="scss" scoped>
.about-dialog {
  background-color: var(--dimmed-background);
}

.about-content {
  display: flex;
  flex-direction: column;
  gap: var(--body-padding);
}

.icon-section {
  display: flex;
  justify-content: center;
  padding: 1rem 0 0.25rem;
}

.app-icon {
  width: 80px;
  height: 80px;
}

.section-body {
  width: 100%;
}

.info-row {
  display: flex;
  flex-direction: column;
  padding: 0.2rem 0;
  font-size: 13px;
  line-height: 1.5;

  strong {
    color: var(--text-primary, inherit);
  }

  a {
    color: var(--mdc-theme-primary);
    text-decoration: none;
    word-break: break-all;

    &:hover {
      text-decoration: underline;
    }
  }
}

.help-block {
  padding: 0.4rem 0;

  &:not(:last-child) {
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    padding-bottom: 0.75rem;
    margin-bottom: 0.25rem;

    @media (prefers-color-scheme: dark) {
      border-bottom-color: rgba(255, 255, 255, 0.08);
    }
  }
}

.help-subtitle {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 0.25rem;
}

.help-text {
  font-size: 12px;
  line-height: 1.5;
  color: var(--dimmed);
  margin: 0.2rem 0;
}

.license-text {
  font-style: italic;
}

.special-rule {
  padding: 0.25rem 0;

  code {
    display: inline;
  }
}

.rule-code {
  font-family: 'Courier New', Courier, monospace;
  background-color: rgba(0, 0, 0, 0.06);
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  font-size: 11px;

  @media (prefers-color-scheme: dark) {
    background-color: rgba(255, 255, 255, 0.1);
  }
}

.block-link {
  display: block;
  color: var(--mdc-theme-primary);
  text-decoration: none;
  font-size: 12px;
  padding: 0.15rem 0;

  &:hover {
    text-decoration: underline;
  }
}
</style>
