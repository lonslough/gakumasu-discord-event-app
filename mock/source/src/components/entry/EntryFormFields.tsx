import type { EntryValues } from '../../lib/validation'
import type { CharacterOption, Submission } from '../../types'
import { ImageFileField } from './ImageFileField'

interface EntryFormFieldsProps {
  values: EntryValues
  errors: Record<string, string>
  existing: Submission | null
  characters: CharacterOption[]
  onChange: (patch: Partial<EntryValues>) => void
}

const basename = (path: string) => path.split('/').pop() ?? path

function ParticipantSection({
  values,
  errors,
  onChange,
}: Pick<EntryFormFieldsProps, 'values' | 'errors' | 'onChange'>) {
  return (
    <section className="card form-section">
      <div className="section-number">01</div>
      <div className="section-content">
        <h2>参加者情報</h2>
        <div className="form-grid">
          <label>
            サーバー内ユーザーネーム <span className="required">必須</span>
            <input
              value={values.discordUsername}
              maxLength={100}
              onChange={(event) =>
                onChange({ discordUsername: event.target.value })
              }
            />
            {errors.discordUsername && (
              <span className="field-error">{errors.discordUsername}</span>
            )}
          </label>
          <label>
            ゲーム内プロデューサーネーム{' '}
            <span className="required">必須</span>
            <input
              value={values.producerName}
              maxLength={100}
              onChange={(event) =>
                onChange({ producerName: event.target.value })
              }
            />
            {errors.producerName && (
              <span className="field-error">{errors.producerName}</span>
            )}
          </label>
        </div>
      </div>
    </section>
  )
}

function CharacterSection({
  values,
  errors,
  existing,
  characters,
  onChange,
}: EntryFormFieldsProps) {
  return (
    <section className="card form-section">
      <div className="section-number">02</div>
      <div className="section-content">
        <h2>育成キャラクター</h2>
        <fieldset>
          <legend>
            育成キャラクターを選択してください{' '}
            <span className="required">必須</span>
          </legend>
          <div className="radio-cards">
            {characters
              .filter(
                (character) =>
                  character.enabled || character.id === existing?.category,
              )
              .map((character) => (
                <label
                  className={
                    values.category === character.id ? 'selected' : ''
                  }
                  key={character.id}
                >
                  <input
                    type="radio"
                    name="category"
                    value={character.id}
                    checked={values.category === character.id}
                    onChange={() => onChange({ category: character.id })}
                  />
                  <span>
                    <strong>{character.name}</strong>
                    <small>
                      {character.shortName || character.id.toUpperCase()}{' '}
                      CATEGORY
                    </small>
                  </span>
                </label>
              ))}
          </div>
          {errors.category && (
            <p className="field-error">{errors.category}</p>
          )}
        </fieldset>
      </div>
    </section>
  )
}

function DivisionSection({
  values,
  errors,
  existing,
  onChange,
}: Pick<EntryFormFieldsProps, 'values' | 'errors' | 'existing' | 'onChange'>) {
  const divisions = [
    ['open', '無差別部門', '参加条件なし'],
    ['switch_off', 'スイッチカードOFF部門', 'スイッチカードOFF必須'],
    ['beginner', '初心者部門', 'スイッチカードOFF必須'],
  ] as const

  return (
    <section className="card form-section">
      <div className="section-number">03</div>
      <div className="section-content">
        <h2>応募部門</h2>
        <fieldset>
          <legend>
            応募部門を選択してください{' '}
            <span className="required">必須</span>
          </legend>
          {existing && (
            <p className="help">応募部門は回答後に変更できません。</p>
          )}
          <div className="radio-cards">
            {divisions.map(([value, label, description]) => (
              <label
                className={
                  values.entryDivision === value ? 'selected' : ''
                }
                key={value}
              >
                <input
                  type="radio"
                  name="entryDivision"
                  value={value}
                  checked={values.entryDivision === value}
                  disabled={Boolean(existing)}
                  onChange={() => onChange({ entryDivision: value })}
                />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </div>
          {values.entryDivision === 'beginner' && (
            <p className="help">
              参加条件：イベント参加時点で「PLv60未満」または「ログイン日数合計90日以下」の方
            </p>
          )}
          {errors.entryDivision && (
            <p className="field-error">{errors.entryDivision}</p>
          )}
        </fieldset>
      </div>
    </section>
  )
}

interface ImageUploadGroupProps {
  title: string
  description: string
  required?: boolean
  fieldProps: React.ComponentProps<typeof ImageFileField>
  sampleSrc: string
  sampleAlt: string
}

function ImageUploadGroup({
  title,
  description,
  required,
  fieldProps,
  sampleSrc,
  sampleAlt,
}: ImageUploadGroupProps) {
  return (
    <div className="image-upload-group">
      <div className="image-upload-heading">
        <h3>
          {title}
          <span className={required ? 'required' : 'optional'}>
            {required ? '必須' : '任意'}
          </span>
        </h3>
        <p className="help">{description}</p>
      </div>
      <div className="image-upload-row">
        <ImageFileField {...fieldProps} />
        <figure className="image-sample">
          <figcaption>アップロード画像例</figcaption>
          <div className="image-column-actions" aria-hidden="true" />
          <img src={sampleSrc} alt={sampleAlt} />
        </figure>
      </div>
    </div>
  )
}

function ImagesSection({
  values,
  errors,
  existing,
  onChange,
}: Pick<EntryFormFieldsProps, 'values' | 'errors' | 'existing' | 'onChange'>) {
  const existingImage = (path: string | null | undefined) =>
    path ? { name: basename(path), path } : null

  return (
    <section className="card form-section">
      <div className="section-number">04</div>
      <div className="section-content">
        <h2>画像アップロード</h2>
        <ImageUploadGroup
          title="評価値・最終所持スキルカード"
          description="評価値と最終所持スキルカードが同時に確認できる画像を添付してください"
          fieldProps={{
            id: 'result',
            label: '評価値・最終所持スキルカード',
            file: values.resultFile,
            existing:
              existing?.score_image_path && !existing.deck_image_path
                ? existingImage(existing.score_image_path)
                : null,
            error: errors.resultFile,
            onChange: (file) => onChange({ resultFile: file }),
          }}
          sampleSrc={`${import.meta.env.BASE_URL}sample/score_sample.png`}
          sampleAlt="評価値・最終所持スキルカード画像の見本"
        />
        {values.entryDivision === 'beginner' && (
          <div className="evidence-fields">
            <ImageUploadGroup
              title="PID・Pレベル確認画像"
              description="PIDとPレベルの両方がわかる画像を添付してください"
              required
              fieldProps={{
                id: 'beginner-proof',
                label: 'PID・Pレベル確認画像',
                file: values.beginnerProofFile,
                existing: existingImage(existing?.beginner_proof_image_path),
                error: errors.beginnerProofFile,
                onChange: (file) => onChange({ beginnerProofFile: file }),
              }}
              sampleSrc={`${import.meta.env.BASE_URL}sample/PID_Plv_sample.PNG`}
              sampleAlt="PID・Pレベル確認画像の見本"
            />
            <ImageUploadGroup
              title="出席日数確認画像"
              description="通知表の出席日数がわかる画像を添付してください"
              required
              fieldProps={{
                id: 'login-days-proof',
                label: '出席日数確認画像',
                file: values.loginDaysProofFile,
                existing: existingImage(existing?.login_days_proof_image_path),
                error: errors.loginDaysProofFile,
                onChange: (file) => onChange({ loginDaysProofFile: file }),
              }}
              sampleSrc={`${import.meta.env.BASE_URL}sample/login_days_sample.png`}
              sampleAlt="出席日数画像の見本"
            />
          </div>
        )}
      </div>
    </section>
  )
}

export function EntryFormFields(props: EntryFormFieldsProps) {
  return (
    <>
      <ParticipantSection {...props} />
      <CharacterSection {...props} />
      <DivisionSection {...props} />
      <ImagesSection {...props} />
    </>
  )
}
