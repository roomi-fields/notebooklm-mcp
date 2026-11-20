/**
 * The noVNC console shows the Chromium signed in to the user's Google account,
 * so it is a credential, not a debugging aid (GHSA-qhvm-xwjm-g4f8). It was
 * started with `x11vnc -nopw` and published on every interface by the shipped
 * docker-compose.yml, which bypassed the API token entirely.
 *
 * Verified in a real container on 2026-11-20: only VNC authentication (type 2)
 * is offered through websockify, the right password is accepted and a wrong
 * one refused, and x11vnc listens on 127.0.0.1 only.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8').replace(/\r\n/g, '\n');
/** Shell lines that run something, comments stripped. */
const commands = (p: string) =>
  read(p)
    .split('\n')
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean);

describe('the noVNC console', () => {
  const vnc = commands('scripts/start-vnc.sh').join('\n');
  const x11vnc = vnc.match(/^x11vnc -display(?:[^\n]*\\\n)*[^\n]*/m)?.[0] ?? '';

  it('never serves the signed-in browser without a password', () => {
    expect(x11vnc).not.toBe('');
    expect(vnc).not.toMatch(/-nopw\b/);
    expect(x11vnc).toMatch(/-rfbauth\b/);
    expect(vnc).toMatch(/x11vnc -storepasswd/);
  });

  it('generates a password when none is given, instead of falling back to none', () => {
    expect(vnc).toMatch(/if \[ -z "\$\{VNC_PASSWORD\}" \]; then\nVNC_PASSWORD="\$\(tr -dc/);
  });

  it('keeps the raw VNC port on loopback, so websockify is the only way in', () => {
    expect(x11vnc).toMatch(/-localhost\b/);
    expect(vnc).toMatch(/^Xvfb [^\n]*-nolisten tcp/m);
  });

  it('is published on loopback only by the shipped compose file', () => {
    const ports = commands('docker-compose.yml').filter((l) => /6080/.test(l));
    expect(ports).toEqual(["- '127.0.0.1:6080:6080'"]);
  });

  it('is documented on loopback with an SSH tunnel, never on every interface', () => {
    for (const doc of ['README.md', 'deployment/docs/08-DOCKER.md']) {
      expect(read(doc)).not.toMatch(/-p 6080:6080/);
      expect(read(doc)).not.toMatch(/nas-ip:6080/);
    }
  });
});
