import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const REVIEW_DIR = path.join(ROOT, "docs", "ui-v2-review");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const DEBUG_PORT = 9333;

const AFTER_URL = "http://127.0.0.1:5173/frontend/";
const BEFORE_URL = "http://127.0.0.1:5174/frontend/";

let nextId = 1;

class CdpPage {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.pending = new Map();
    this.events = [];
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result || {});
        return;
      }
      if (message.method) this.events.push(message);
    });
  }

  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
  }

  async send(method, params = {}) {
    await this.ready();
    const id = nextId++;
    const payload = JSON.stringify({ id, method, params });
    const result = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.ws.send(payload);
    return result;
  }

  close() {
    this.ws.close();
  }
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, attempts = 60) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      // keep waiting
    }
    await wait(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function launchChrome() {
  const userDataDir = path.join(os.tmpdir(), `visionid-ui-v2-${Date.now()}`);
  await rm(userDataDir, { recursive: true, force: true });
  const child = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${DEBUG_PORT}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${userDataDir}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank"
  ], {
    stdio: "ignore",
    detached: false
  });

  await waitForJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
  return { child, userDataDir };
}

async function openPage(url) {
  const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, {
    method: "PUT"
  });
  if (!response.ok) {
    throw new Error(`Could not open page: ${response.status}`);
  }
  const target = await response.json();
  const page = new CdpPage(target.webSocketDebuggerUrl);
  await page.ready();
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("Log.enable");
  await page.send("Page.navigate", { url });
  await waitForLoad(page);
  return page;
}

async function waitForLoad(page) {
  for (let index = 0; index < 80; index += 1) {
    const state = await page.send("Runtime.evaluate", {
      expression: "document.readyState",
      returnByValue: true
    });
    if (state?.result?.value === "complete") {
      await wait(500);
      return;
    }
    await wait(100);
  }
  throw new Error("Timed out waiting for page load");
}

function qaCustomers() {
  const now = "2026-07-31T09:30:00.000Z";
  const analysis = {
    shape: "oval",
    label: "Oval pha dài",
    faceShape_ai: "oval",
    faceShape_confirmed: "oval",
    metrics: {
      lengthToWidth: 1.38,
      foreheadToCheek: 0.92,
      jawToCheek: 0.84,
      jawToForehead: 0.91,
      cheekToJaw: 1.19
    },
    quality: {
      confidence: 0.86,
      centerOffsetX: 0.03,
      centerOffsetY: 0.04,
      coverage: 0.24,
      symmetryScore: 0.82,
      faceBox: { x: 0.34, y: 0.18, width: 0.32, height: 0.48 }
    },
    diagnostics: {
      confidenceBand: "Cao",
      distanceLabel: "Đúng khoảng",
      frameCount: 24,
      usableSampleCount: 21,
      fallbackUsed: false,
      limitations: [
        "Chưa đo kích thước vật lý theo mm.",
        "Phân tích tỷ lệ để hỗ trợ tư vấn gọng."
      ],
      topCandidates: [
        { label: "Oval pha dài", score: 0.86, reason: "Tỷ lệ cân bằng, đường nét mềm." },
        { label: "Đường nét mềm", score: 0.61, reason: "Hàm không quá góc cạnh." },
        { label: "Gò má hơi nổi", score: 0.45, reason: "Cần kiểm tra khi thử gọng thật." }
      ]
    },
    privacyConsent: { analysisStorage: true }
  };

  const recommendations = [
    { name: "Gọng browline mềm", reason: "Tạo điểm nhấn phía trên nhưng không làm mặt nặng.", material: "Titanium", rimType: "full-rim" },
    { name: "Gọng oval bản vừa", reason: "Giữ cảm giác nhẹ, cân bằng với gò má.", material: "Acetate", rimType: "full-rim" },
    { name: "Gọng chữ nhật bo góc", reason: "Tăng nét gọn mà vẫn mềm.", material: "Ultem", rimType: "full-rim" }
  ];

  const lensRecommendations = [
    { name: "Essilor Element Blue UV 1.60", index: "1.60", reason: "Đeo hằng ngày, chống phản quang và màn hình.", evidence: "Độ cận trung bình, ưu tiên mỏng nhẹ vừa phải." },
    { name: "Crizal Natural Look 1.67", index: "1.67", reason: "Dự phòng khi khách muốn tròng mỏng hơn.", evidence: "Phù hợp nếu chọn form lớn hơn." }
  ];

  const main = {
    customer_code: "KH-20260731-QA01",
    session_code: "PC-20260731-093000-QA",
    customer_name: "Khach QA 01",
    customer_phone: "0000000001",
    consult_date: "2026-07-31",
    age_group: "office",
    customer_notes: "Khách làm văn phòng, cần kính nhẹ, lịch sự, dùng cả ngày.",
    customer_status: "waiting",
    frame_width_mm: 138,
    lens_width_mm: 51,
    bridge_width_mm: 19,
    has_prescription: true,
    prescription: { pd: 62, sph: -3.25, cyl: -0.75 },
    preferences: {
      budget: "medium",
      purpose: "daily",
      prescription_level: "medium",
      frame_preference: "balanced",
      brands: ["Fano", "Essilor", "Carl Zeiss"]
    },
    analysis,
    faceShape_ai: "oval",
    faceShape_confirmed: "oval",
    consultation_mode: "visionid",
    recommendations,
    lens_recommendations: lensRecommendations,
    consultation_result: {
      consultationSource: "visionid_camera",
      sourceLabel: "VisionID đã xác nhận",
      primaryFrameRecommendation: recommendations[0],
      alternativeFrameRecommendations: recommendations.slice(1),
      lensRecommendations,
      summary: "Ưu tiên browline mềm hoặc oval bản vừa, chất liệu nhẹ để đeo cả ngày.",
      savedAt: now
    },
    consultation_saved_at: now,
    consultation_source: "visionid_camera",
    created_at: now,
    updated_at: now
  };

  const second = {
    ...main,
    customer_code: "KH-20260731-QA02",
    session_code: "PC-20260731-101500-QB",
    customer_name: "Khach QA 02",
    customer_phone: "0000000002",
    customer_notes: "Ưu tiên gọng thời trang, màu trong hoặc tortoise.",
    faceShape_confirmed: "round",
    faceShape_ai: "round",
    analysis: { ...analysis, shape: "round", label: "Tròn pha oval", faceShape_ai: "round", faceShape_confirmed: "round" },
    updated_at: "2026-07-31T10:15:00.000Z"
  };

  const third = {
    ...main,
    customer_code: "KH-20260731-QA03",
    session_code: "PC-20260731-104000-QC",
    customer_name: "Khach QA 03",
    customer_phone: "0000000003",
    customer_notes: "Có đơn kính, muốn gọng nhẹ cho học tập.",
    age_group: "student",
    customer_status: "consulting",
    faceShape_confirmed: "diamond",
    faceShape_ai: "diamond",
    analysis: { ...analysis, shape: "diamond", label: "Gò má nổi bật", faceShape_ai: "diamond", faceShape_confirmed: "diamond" },
    updated_at: "2026-07-31T10:40:00.000Z"
  };

  return { customers: [main, second, third], current: main };
}

async function evaluate(page, expression, awaitPromise = false) {
  const result = await page.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    const description = result.exceptionDetails.exception?.description
      || result.exceptionDetails.exception?.value
      || result.exceptionDetails.text
      || "Runtime exception";
    throw new Error(description);
  }
  return result.result?.value;
}

async function seedData(page) {
  const payload = JSON.stringify(qaCustomers()).replace(/</g, "\\u003c");
  await evaluate(page, `
    (() => {
      const payload = ${payload};
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('dongdo_optic_customers', JSON.stringify(payload.customers));
      localStorage.setItem('current_customer', JSON.stringify(payload.current));
      localStorage.removeItem('dongdo_optic_operation_draft_v1');
      location.reload();
    })()
  `);
  await wait(900);
}

async function resumeDraftDialog(page) {
  await evaluate(page, `
    (() => {
      const dialog = document.getElementById('operationDraftDialog');
      const button = document.getElementById('resumeDraftButton');
      if (dialog && !dialog.hidden && button) {
        button.click();
      }
    })()
  `);
  await wait(700);
}

async function setViewport(page, width, height, scale = 1) {
  await page.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: scale,
    mobile: width < 700,
    screenWidth: width,
    screenHeight: height
  });
}

async function screenshot(page, filename) {
  const result = await page.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  });
  await writeFile(path.join(REVIEW_DIR, filename), Buffer.from(result.data, "base64"));
}

async function clickTab(page, tabId) {
  await evaluate(page, `
    (() => {
      document.querySelector('[data-tab-target="${tabId}"]')?.click();
      window.scrollTo(0, 0);
    })()
  `);
  await wait(700);
}

async function clickMobileAction(page, buttonId) {
  await evaluate(page, `
    (() => {
      document.getElementById(${JSON.stringify(buttonId)})?.click();
      window.scrollTo(0, 0);
    })()
  `);
  await wait(700);
}

async function clickButton(page, buttonId, waitMs = 500) {
  await evaluate(page, `
    (() => {
      document.getElementById(${JSON.stringify(buttonId)})?.click();
    })()
  `);
  await wait(waitMs);
}

async function searchCustomer(page, query) {
  await evaluate(page, `
    (() => {
      const input = document.getElementById('customerSearch');
      input.value = ${JSON.stringify(query)};
      input.dispatchEvent(new Event('input', { bubbles: true }));
      window.scrollTo(0, 0);
    })()
  `);
  await wait(700);
}

async function collectMetrics(page) {
  return evaluate(page, `
    (() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom, right: box.right };
      };
      const visibleModal = [...document.querySelectorAll('.modal-backdrop')].find((modal) => !modal.hidden);
      const cutTextElements = [...document.querySelectorAll('button, .status-chip, .customer-card strong, .customer-card span, .content-title h1, .section-heading h2')]
        .filter((element) => {
          const style = getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          return element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2;
        })
        .map((element) => ({
          tag: element.tagName,
          id: element.id || "",
          className: String(element.className || ""),
          text: (element.textContent || "").trim().slice(0, 80),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        }));
      const cutTextCount = cutTextElements.length;
      const video = document.getElementById('webcam');
      const canvas = document.getElementById('overlay');
      const videoRect = video?.getBoundingClientRect();
      const canvasRect = canvas?.getBoundingClientRect();
      return {
        url: location.href,
        activeTab: document.querySelector('.tab-panel.active')?.id || '',
        viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
        horizontalOverflow: document.body.scrollWidth > document.documentElement.clientWidth + 1,
        bodyScrollWidth: document.body.scrollWidth,
        documentWidth: document.documentElement.clientWidth,
        sidebar: rect('.sidebar'),
        contentHeader: rect('.content-header'),
        customerSession: rect('#currentCustomerSession'),
        cameraPanel: rect('.camera-panel'),
        cameraActions: rect('.camera-actions'),
        mobileActionBar: rect('.mobile-action-bar'),
        modal: visibleModal ? visibleModal.getBoundingClientRect().toJSON() : null,
        cutTextCount,
        cutTextElements,
        videoCanvasSameCssBox: Boolean(videoRect && canvasRect && Math.abs(videoRect.width - canvasRect.width) < 1 && Math.abs(videoRect.height - canvasRect.height) < 1),
        videoReady: Boolean(video && video.videoWidth > 0 && video.videoHeight > 0),
        canvasIntrinsic: canvas ? { width: canvas.width, height: canvas.height } : null
      };
    })()
  `);
}

async function focusCheck(page) {
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await wait(100);
  return evaluate(page, `
    (() => {
      const active = document.activeElement;
      const style = active ? getComputedStyle(active) : null;
      return {
        activeTag: active?.tagName || '',
        activeId: active?.id || '',
        outlineStyle: style?.outlineStyle || '',
        outlineWidth: style?.outlineWidth || '',
        boxShadow: style?.boxShadow || ''
      };
    })()
  `);
}

async function run() {
  await mkdir(REVIEW_DIR, { recursive: true });
  const { child, userDataDir } = await launchChrome();
  const report = {
    files: [],
    metrics: {},
    checks: {},
    consoleErrors: []
  };

  try {
    const before = await openPage(BEFORE_URL);
    await setViewport(before, 1440, 900, 1);
    await seedData(before);
    await resumeDraftDialog(before);
    await screenshot(before, "before-desktop-profile.png");
    before.close();

    const page = await openPage(AFTER_URL);
    await setViewport(page, 1440, 900, 1);
    await seedData(page);
    await resumeDraftDialog(page);
    await screenshot(page, "after-desktop-profile.png");
    await screenshot(page, "desktop-profile.png");
    report.metrics.desktopProfile = await collectMetrics(page);

    await searchCustomer(page, "Linh");
    await screenshot(page, "desktop-search.png");
    report.metrics.desktopSearch = await collectMetrics(page);

    await clickTab(page, "tab-3");
    await screenshot(page, "desktop-visionid.png");
    report.metrics.desktopVisionid = await collectMetrics(page);

    await clickTab(page, "tab-4");
    await screenshot(page, "desktop-consultation.png");
    report.metrics.desktopConsultation = await collectMetrics(page);

    await setViewport(page, 1366, 768, 1);
    await clickTab(page, "tab-3");
    report.metrics.desktop1366Visionid = await collectMetrics(page);
    await setViewport(page, 1440, 900, 1);
    await clickTab(page, "tab-4");

    report.checks.focusVisible = await focusCheck(page);

    await page.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }]
    });
    report.checks.prefersReducedMotion = await evaluate(page, `matchMedia('(prefers-reduced-motion: reduce)').matches`);
    await page.send("Emulation.setEmulatedMedia", { features: [] });

    await setViewport(page, 720, 450, 1);
    report.metrics.zoom200Approximation = await evaluate(page, `
      (() => {
        document.documentElement.style.zoom = '200%';
        const result = {
          horizontalOverflow: document.body.scrollWidth > document.documentElement.clientWidth + 1,
          canReachPrimaryCta: Boolean(document.elementFromPoint(Math.min(innerWidth - 20, 680), 80))
        };
        document.documentElement.style.zoom = '';
        return result;
      })()
    `);

    await setViewport(page, 390, 844, 2);
    await seedData(page);
    await resumeDraftDialog(page);
    await screenshot(page, "mobile-consultation.png");
    report.metrics.mobileConsultation = await collectMetrics(page);

    await clickTab(page, "tab-0");
    await screenshot(page, "mobile-profile.png");
    report.metrics.mobileProfile = await collectMetrics(page);

    await clickMobileAction(page, "mobileScanButton");
    await screenshot(page, "mobile-visionid.png");
    report.metrics.mobileVisionid = await collectMetrics(page);

    await clickButton(page, "cameraStartButton", 250);
    await screenshot(page, "mobile-visionid-scanning.png");
    report.metrics.mobileVisionidScanning = await collectMetrics(page);

    await setViewport(page, 844, 390, 2);
    await seedData(page);
    await resumeDraftDialog(page);
    await clickMobileAction(page, "mobileScanButton");
    await screenshot(page, "mobile-visionid-landscape.png");
    report.metrics.mobileVisionidLandscape = await collectMetrics(page);

    await setViewport(page, 360, 800, 2);
    await seedData(page);
    await resumeDraftDialog(page);
    await clickTab(page, "tab-0");
    report.metrics.mobile360Profile = await collectMetrics(page);
    await clickMobileAction(page, "mobileScanButton");
    report.metrics.mobile360Visionid = await collectMetrics(page);
    await clickMobileAction(page, "mobileConsultButton");
    report.metrics.mobile360Consultation = await collectMetrics(page);

    await setViewport(page, 768, 1024, 2);
    await seedData(page);
    await resumeDraftDialog(page);
    await clickMobileAction(page, "mobileScanButton");
    report.metrics.ipadPortraitVisionid = await collectMetrics(page);

    const logs = page.events
      .filter((event) => event.method === "Runtime.exceptionThrown" || event.method === "Log.entryAdded")
      .map((event) => event.params)
      .filter((entry) => JSON.stringify(entry).toLowerCase().includes("error"));
    report.consoleErrors = logs;
    page.close();
  } finally {
    child.kill();
    await wait(500);
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }

  report.files = [
    "desktop-profile.png",
    "desktop-search.png",
    "desktop-visionid.png",
    "desktop-consultation.png",
    "mobile-profile.png",
    "mobile-visionid.png",
    "mobile-consultation.png",
    "mobile-visionid-scanning.png",
    "mobile-visionid-landscape.png",
    "before-desktop-profile.png",
    "after-desktop-profile.png"
  ];
  await writeFile(path.join(REVIEW_DIR, "capture-results.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
