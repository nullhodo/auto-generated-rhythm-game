# auto-generated-rhythm-game

Webブラウザ上で自動生成される楽曲に合わせて楽しむ4レーン型リズムゲーム。

## 1. 概要

楽曲とノーツ譜面が起動ごとにプロシージャル自動生成されるリズムアクションWebゲーム。
EDM進行に基づいたシンセサイザーとドラムトラックがリアルタイムに合成・演奏され、それに同期した譜面が生成されます。
通常ノーツの打鍵時にはキレのあるスネアショット音、ロングノーツのホールド中には爽快なスネア連打（ドラムロール）効果音がWeb Audio APIでリアルタイム合成されます。

## 2. 仕組み

Web Audio APIによるリアルタイムシンセシスとCanvas 2Dによる高パフォーマンスレンダリングを組み合わせ、React + Jotai + Framer MotionでモダンなUIを実現しています。

- 言語: TypeScript
- UIフレームワーク: React 19
- ビジュアル生成: p5.js (WMP / VJ風オーディオビジュアライザー)
- 状態管理: Jotai
- UIアニメーション: Framer Motion
- アイコン: Lucide React
- CSSトークン: Open Props
- ビルドツール: Vite
- リンター / フォーマッター: Biome
- デッドコード検出: Knip
- テストフレームワーク: Vitest
- パッケージマネージャー: pnpm

## 3. 構造

```text
auto-generated-rhythm-game
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── biome.json
├── knip.json
├── .gitignore
├── README.md
├── output/                   - 画像・動画出力用ディレクトリ
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── types/
    │   └── game.ts           - ゲームステート・イベント・ノーツ等の型定義
    ├── audio/
    │   ├── audio-engine.ts   - Web Audio APIシンセ・ドラム・サイドチェイン音響エンジン
    │   └── song-generator.ts - プロシージャル楽曲・譜面自動生成ロジック
    ├── game/
    │   ├── canvas-renderer.ts - Canvas 2Dによるレーン・ノーツ・演出描画
    │   ├── game-engine.ts    - ゲームループ・タイミング判定・スコア計算
    │   └── layout.ts         - 画面サイズに応じたレスポンシブ配置・境界判定
    ├── state/
    │   └── atoms.ts          - Jotaiステート定義 (スコア、コンボ、BPM等)
    ├── components/
    │   ├── GameCanvas.tsx    - Canvas要素のマウントと入力イベント制御
    │   ├── VJBackground.tsx  - p5.jsによるWMP風VJ背景ビジュアライザー
    │   ├── StartScreen.tsx   - タイトル画面オーバーレイ
    │   ├── HUD.tsx           - スコア・コンボ・BPM・音量コントロールHUD
    │   ├── TrackNotification.tsx - 楽曲開始時のKey/コード進行通知 (右下)
    │   └── ResultScreen.tsx  - リザルト画面
    └── test/
        ├── layout.test.ts    - 画面解像度別のはみ出し・境界判定テスト
        ├── song-generator.test.ts - 楽曲構造・スケール適合・EDMドラム生成テスト
        ├── game-engine.test.ts - タイミング判定・コンボ追跡・ライフサイクルテスト
        ├── audio-engine.test.ts - Web Audio API音響合成・効果音・サイドチェインテスト
        ├── canvas-renderer.test.ts - Canvas描画処理・エフェクト減衰テスト
        └── atoms.test.ts     - Jotaiアトム初期値・状態遷移テスト
```

## 4. 実行方法

| コマンド | 実行内容 |
|---|---|
| `pnpm install` | 依存パッケージのインストール |
| `pnpm dev` | 開発サーバーの起動 (ローカル開発時はタブタイトルに `[DEV]` が付与) |
| `pnpm build` | 本番用TypeScriptコンパイルおよびバンドルビルド |
| `pnpm test` | Vitestによるテストの実行 (はみ出しチェック・楽曲生成テスト等) |
| `pnpm lint` | Biomeによる静的解析チェック |
| `pnpm format` | Biomeによるコード・Markdownの自動整形 |
| `pnpm knip` | Knipによる未使用ファイル・依存関係の検出 |

