import { Prisma, ProjectActivityType } from "@prisma/client";
import { getLocale, t } from "@/lib/locale";
import {
  createActivity,
  createIssue,
  createRisk,
  deleteActivity,
  deleteIssue,
  deleteRisk,
  updateActivity,
  updateIssue,
  updateProjectSummaryField,
  updateRisk,
} from "@/app/project-overview-actions";
import { getProjectDetails } from "@/server/services/project-overview-service";

export const revalidate = 0;

function formatDate(value: Date | null, locale: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(value);
}

function formatDateInput(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  return value === null || value === undefined ? 0 : Number(value);
}

function formatPercent(value: Prisma.Decimal | number, locale: string) {
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(decimalToNumber(value))}%`;
}

function formatCurrency(value: Prisma.Decimal | number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(decimalToNumber(value));
}

export default async function ProjectDetailsPage() {
  const locale = await getLocale();
  const localeText = t(locale);
  const numberLocale = locale === "ar" ? "ar-SA" : "en-US";
  const { summary, activities, risks, issues } = await getProjectDetails();

  const activityGroups = [
    {
      type: ProjectActivityType.PREVIOUS,
      title: localeText.projectDetails.previousActivities,
      rows: activities.filter((activity) => activity.type === ProjectActivityType.PREVIOUS),
    },
    {
      type: ProjectActivityType.CURRENT,
      title: localeText.projectDetails.currentActivities,
      rows: activities.filter((activity) => activity.type === ProjectActivityType.CURRENT),
    },
    {
      type: ProjectActivityType.UPCOMING,
      title: localeText.projectDetails.upcomingActivities,
      rows: activities.filter((activity) => activity.type === ProjectActivityType.UPCOMING),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="panel-surface">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">{localeText.projectDetails.eyebrow}</p>
            <h1 className="section-title">{localeText.projectDetails.title}</h1>
            <p className="section-copy">{localeText.projectDetails.description}</p>
          </div>
          <a href="/api/project-report/export" className="primary-button">
            {localeText.buttons.exportExcel}
          </a>
        </div>
      </section>

      <ProjectSummaryEditSection
        summary={summary}
        localeText={localeText}
        numberLocale={numberLocale}
      />

      <section className="grid gap-6 xl:grid-cols-3">
        {activityGroups.map((group) => (
          <ActivitySection
            key={group.type}
            title={group.title}
            type={group.type}
            activities={group.rows}
            labels={{
              add: localeText.buttons.add,
              edit: localeText.buttons.edit,
              save: localeText.buttons.save,
              cancel: localeText.buttons.cancel,
              delete: localeText.buttons.delete,
              editAria: localeText.aria.edit,
              deleteAria: localeText.aria.delete,
              addActivity: localeText.projectDetails.addActivity,
              editActivity: localeText.projectDetails.editActivity,
              activityText: localeText.projectDetails.activityText,
              noActivities: localeText.projectDetails.noActivities,
              requiredText: localeText.validation.requiredText,
            }}
          />
        ))}
      </section>

      <section className="panel-surface">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-[var(--ink-strong)]">
            {localeText.projectDetails.risks}
          </h2>
        </div>
        {risks.length === 0 ? (
          <EmptyState label={localeText.projectDetails.noRisks} />
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{localeText.projectDetails.riskDescription}</th>
                  <th>{localeText.projectDetails.date}</th>
                  <th>{localeText.projectDetails.impact}</th>
                  <th>{localeText.projectDetails.probability}</th>
                  <th>{localeText.projectDetails.owner}</th>
                  <th>{localeText.projectDetails.responsePlan}</th>
                  <th>{localeText.projectDetails.status}</th>
                  <th>{localeText.projectDetails.closureDate}</th>
                  <th>{localeText.projectDetails.actions}</th>
                </tr>
              </thead>
              <tbody>
                {risks.map((risk) => (
                  <tr key={risk.id}>
                    <td>{risk.description}</td>
                    <td>{formatDate(risk.date, numberLocale)}</td>
                    <td>{risk.impact}</td>
                    <td>{risk.probability}</td>
                    <td>{risk.owner}</td>
                    <td>{risk.responsePlan}</td>
                    <td><span className="status-pill">{risk.status}</span></td>
                    <td>{formatDate(risk.closureDate, numberLocale)}</td>
                    <td>
                      <RowActions
                        editAriaLabel={localeText.aria.edit}
                        deleteAriaLabel={localeText.aria.delete}
                        cancelLabel={localeText.buttons.cancel}
                        deleteAction={deleteRisk}
                        id={risk.id}
                      >
                        <RiskForm
                          id={risk.id}
                          risk={risk}
                          labels={localeText.projectDetails}
                          buttons={localeText.buttons}
                          requiredText={localeText.validation.requiredText}
                        />
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-6 border-t border-[rgba(17,17,17,0.08)] pt-5">
          <RiskForm
            labels={localeText.projectDetails}
            buttons={localeText.buttons}
            requiredText={localeText.validation.requiredText}
          />
        </div>
      </section>

      <section className="panel-surface">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-[var(--ink-strong)]">
            {localeText.projectDetails.issues}
          </h2>
        </div>
        {issues.length === 0 ? (
          <EmptyState label={localeText.projectDetails.noIssues} />
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{localeText.projectDetails.issueDescription}</th>
                  <th>{localeText.projectDetails.date}</th>
                  <th>{localeText.projectDetails.owner}</th>
                  <th>{localeText.projectDetails.responsePlan}</th>
                  <th>{localeText.projectDetails.status}</th>
                  <th>{localeText.projectDetails.closureDate}</th>
                  <th>{localeText.projectDetails.actions}</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={issue.id}>
                    <td>{issue.description}</td>
                    <td>{formatDate(issue.date, numberLocale)}</td>
                    <td>{issue.owner}</td>
                    <td>{issue.responsePlan}</td>
                    <td><span className="status-pill">{issue.status}</span></td>
                    <td>{formatDate(issue.closureDate, numberLocale)}</td>
                    <td>
                      <RowActions
                        editAriaLabel={localeText.aria.edit}
                        deleteAriaLabel={localeText.aria.delete}
                        cancelLabel={localeText.buttons.cancel}
                        deleteAction={deleteIssue}
                        id={issue.id}
                      >
                        <IssueForm
                          id={issue.id}
                          issue={issue}
                          labels={localeText.projectDetails}
                          buttons={localeText.buttons}
                          requiredText={localeText.validation.requiredText}
                        />
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-6 border-t border-[rgba(17,17,17,0.08)] pt-5">
          <IssueForm
            labels={localeText.projectDetails}
            buttons={localeText.buttons}
            requiredText={localeText.validation.requiredText}
          />
        </div>
      </section>
    </div>
  );
}

function ProjectSummaryEditSection({
  summary,
  localeText,
  numberLocale,
}: {
  summary: {
    startDate: Date | null;
    expectedEndDate: Date | null;
    baselineProgress: Prisma.Decimal;
    actualProgress: Prisma.Decimal;
    totalProjectValue: Prisma.Decimal;
    totalProjectInvoices: Prisma.Decimal;
    totalCollectedValue: Prisma.Decimal;
    remainingUnbilledValue: Prisma.Decimal;
  };
  localeText: ReturnType<typeof t>;
  numberLocale: string;
}) {
  return (
    <section className="panel-surface">
      <div className="mb-5">
        <p className="eyebrow">{localeText.home.projectSummary}</p>
        <h2 className="section-title">{localeText.projectDetails.editProjectSummary}</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ProjectSummaryField
          label={localeText.projectOverview.startDate}
          field="startDate"
          inputType="date"
          inputValue={formatDateInput(summary.startDate)}
          displayValue={formatDate(summary.startDate, numberLocale)}
          localeText={localeText}
        />
        <ProjectSummaryField
          label={localeText.projectOverview.expectedEndDate}
          field="expectedEndDate"
          inputType="date"
          inputValue={formatDateInput(summary.expectedEndDate)}
          displayValue={formatDate(summary.expectedEndDate, numberLocale)}
          localeText={localeText}
        />
        <ProjectSummaryField
          label={localeText.projectOverview.baselineProgress}
          field="baselineProgress"
          inputType="number"
          inputValue={String(decimalToNumber(summary.baselineProgress))}
          displayValue={formatPercent(summary.baselineProgress, numberLocale)}
          localeText={localeText}
          min={0}
          max={100}
          step="0.01"
        />
        <ProjectSummaryField
          label={localeText.projectOverview.actualProgress}
          field="actualProgress"
          inputType="number"
          inputValue={String(decimalToNumber(summary.actualProgress))}
          displayValue={formatPercent(summary.actualProgress, numberLocale)}
          localeText={localeText}
          min={0}
          max={100}
          step="0.01"
        />
        <ProjectSummaryField
          label={localeText.projectOverview.totalProjectValue}
          field="totalProjectValue"
          inputType="number"
          inputValue={String(decimalToNumber(summary.totalProjectValue))}
          displayValue={formatCurrency(summary.totalProjectValue, numberLocale)}
          localeText={localeText}
          min={0}
          step="0.01"
        />
        <ProjectSummaryField
          label={localeText.projectOverview.totalProjectInvoices}
          field="totalProjectInvoices"
          inputType="number"
          inputValue={String(decimalToNumber(summary.totalProjectInvoices))}
          displayValue={formatCurrency(summary.totalProjectInvoices, numberLocale)}
          localeText={localeText}
          min={0}
          step="0.01"
        />
        <ProjectSummaryField
          label={localeText.projectOverview.totalCollectedValue}
          field="totalCollectedValue"
          inputType="number"
          inputValue={String(decimalToNumber(summary.totalCollectedValue))}
          displayValue={formatCurrency(summary.totalCollectedValue, numberLocale)}
          localeText={localeText}
          min={0}
          step="0.01"
        />
        <ProjectSummaryField
          label={localeText.projectOverview.remainingUnbilledValue}
          field="remainingUnbilledValue"
          inputType="number"
          inputValue={String(decimalToNumber(summary.remainingUnbilledValue))}
          displayValue={formatCurrency(summary.remainingUnbilledValue, numberLocale)}
          localeText={localeText}
          min={0}
          step="0.01"
        />
      </div>
    </section>
  );
}

function ProjectSummaryField({
  label,
  field,
  inputType,
  inputValue,
  displayValue,
  localeText,
  min,
  max,
  step,
}: {
  label: string;
  field: string;
  inputType: "date" | "number";
  inputValue: string;
  displayValue: string;
  localeText: ReturnType<typeof t>;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <div className="jawraa-subcard p-4">
      <p className="text-sm font-semibold text-[var(--ink-soft)]">{label}</p>
      <p className="mt-2 text-xl font-bold text-[var(--ink-strong)]">{displayValue}</p>
      <details className="mt-3">
        <summary
          aria-label={localeText.aria.edit}
          title={localeText.aria.edit}
          className="icon-button cursor-pointer"
        >
          <EditIcon />
        </summary>
        <form action={updateProjectSummaryField} className="mt-3 space-y-3">
          <input type="hidden" name="field" value={field} />
          <input
            name="value"
            type={inputType}
            defaultValue={inputValue}
            min={min}
            max={max}
            step={step}
            required
            className="field-input min-h-[2.75rem]"
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="primary-button min-h-[2.5rem] px-3 text-sm">
              {localeText.buttons.save}
            </button>
            <a href="/project-details" className="secondary-button min-h-[2.5rem] px-3 text-sm">
              {localeText.buttons.cancel}
            </a>
          </div>
        </form>
      </details>
    </div>
  );
}

function ActivitySection({
  title,
  type,
  activities,
  labels,
}: {
  title: string;
  type: ProjectActivityType;
  activities: Array<{ id: string; text: string }>;
  labels: {
    add: string;
    edit: string;
    save: string;
    cancel: string;
    delete: string;
    editAria: string;
    deleteAria: string;
    addActivity: string;
    editActivity: string;
    activityText: string;
    noActivities: string;
    requiredText: string;
  };
}) {
  return (
    <section className="panel-surface">
      <h2 className="text-lg font-semibold text-[var(--ink-strong)]">{title}</h2>
      <div className="mt-4 space-y-3">
        {activities.length === 0 ? (
          <EmptyState label={labels.noActivities} />
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="jawraa-subcard p-4">
              <p className="leading-7 text-[var(--ink-strong)]">{activity.text}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <details>
                  <summary
                    aria-label={labels.editAria}
                    title={labels.editAria}
                    className="icon-button cursor-pointer"
                  >
                    <EditIcon />
                  </summary>
                  <form action={updateActivity} className="mt-3 space-y-3">
                    <input type="hidden" name="id" value={activity.id} />
                    <input type="hidden" name="type" value={type} />
                    <textarea
                      name="text"
                      defaultValue={activity.text}
                      required
                      title={labels.requiredText}
                      className="field-input min-h-[5.5rem]"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button type="submit" className="primary-button min-h-[2.5rem] px-3 text-sm">
                        {labels.save}
                      </button>
                      <a href="/project-details" className="secondary-button min-h-[2.5rem] px-3 text-sm">
                        {labels.cancel}
                      </a>
                    </div>
                  </form>
                </details>
                <form action={deleteActivity}>
                  <input type="hidden" name="id" value={activity.id} />
                  <button
                    type="submit"
                    aria-label={labels.deleteAria}
                    title={labels.deleteAria}
                    className="icon-button"
                  >
                    <TrashIcon />
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
      <form action={createActivity} className="mt-5 space-y-3 border-t border-[rgba(17,17,17,0.08)] pt-4">
        <input type="hidden" name="type" value={type} />
        <label className="field-shell">
          <span className="field-label">{labels.activityText}</span>
          <textarea
            name="text"
            required
            title={labels.requiredText}
            className="field-input min-h-[5.5rem]"
          />
        </label>
        <button type="submit" className="primary-button">
          {labels.add}
        </button>
      </form>
    </section>
  );
}

function RiskForm({
  id,
  risk,
  labels,
  buttons,
  requiredText,
}: {
  id?: string;
  risk?: {
    description: string;
    date: Date | null;
    impact: string;
    probability: string;
    owner: string;
    responsePlan: string;
    status: string;
    closureDate: Date | null;
  };
  labels: {
    addRisk: string;
    editRisk: string;
    riskDescription: string;
    date: string;
    impact: string;
    probability: string;
    owner: string;
    responsePlan: string;
    status: string;
    closureDate: string;
  };
  buttons: { add: string; save: string };
  requiredText: string;
}) {
  return (
    <form action={id ? updateRisk : createRisk} className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <TextField name="description" label={labels.riskDescription} defaultValue={risk?.description} requiredText={requiredText} />
      <DateField name="date" label={labels.date} defaultValue={formatDateInput(risk?.date ?? null)} />
      <TextField name="impact" label={labels.impact} defaultValue={risk?.impact} requiredText={requiredText} />
      <TextField name="probability" label={labels.probability} defaultValue={risk?.probability} requiredText={requiredText} />
      <TextField name="owner" label={labels.owner} defaultValue={risk?.owner} requiredText={requiredText} />
      <TextField name="responsePlan" label={labels.responsePlan} defaultValue={risk?.responsePlan} requiredText={requiredText} />
      <TextField name="status" label={labels.status} defaultValue={risk?.status} requiredText={requiredText} />
      <DateField name="closureDate" label={labels.closureDate} defaultValue={formatDateInput(risk?.closureDate ?? null)} />
      <div className="lg:col-span-2 xl:col-span-4">
        <button type="submit" className="primary-button">
          {id ? buttons.save : buttons.add}
        </button>
      </div>
    </form>
  );
}

function IssueForm({
  id,
  issue,
  labels,
  buttons,
  requiredText,
}: {
  id?: string;
  issue?: {
    description: string;
    date: Date | null;
    owner: string;
    responsePlan: string;
    status: string;
    closureDate: Date | null;
  };
  labels: {
    addIssue: string;
    editIssue: string;
    issueDescription: string;
    date: string;
    owner: string;
    responsePlan: string;
    status: string;
    closureDate: string;
  };
  buttons: { add: string; save: string };
  requiredText: string;
}) {
  return (
    <form action={id ? updateIssue : createIssue} className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <TextField name="description" label={labels.issueDescription} defaultValue={issue?.description} requiredText={requiredText} />
      <DateField name="date" label={labels.date} defaultValue={formatDateInput(issue?.date ?? null)} />
      <TextField name="owner" label={labels.owner} defaultValue={issue?.owner} requiredText={requiredText} />
      <TextField name="responsePlan" label={labels.responsePlan} defaultValue={issue?.responsePlan} requiredText={requiredText} />
      <TextField name="status" label={labels.status} defaultValue={issue?.status} requiredText={requiredText} />
      <DateField name="closureDate" label={labels.closureDate} defaultValue={formatDateInput(issue?.closureDate ?? null)} />
      <div className="lg:col-span-2 xl:col-span-3">
        <button type="submit" className="primary-button">
          {id ? buttons.save : buttons.add}
        </button>
      </div>
    </form>
  );
}

function TextField({
  name,
  label,
  defaultValue,
  requiredText,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  requiredText: string;
}) {
  return (
    <label className="field-shell">
      <span className="field-label">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        required
        title={requiredText}
        className="field-input"
      />
    </label>
  );
}

function DateField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <label className="field-shell">
      <span className="field-label">{label}</span>
      <input name={name} type="date" defaultValue={defaultValue} className="field-input" />
    </label>
  );
}

function RowActions({
  id,
  editAriaLabel,
  deleteAriaLabel,
  cancelLabel,
  deleteAction,
  children,
}: {
  id: string;
  editAriaLabel: string;
  deleteAriaLabel: string;
  cancelLabel: string;
  deleteAction: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-[11rem] flex-wrap gap-2">
      <details className="w-full">
        <summary
          aria-label={editAriaLabel}
          title={editAriaLabel}
          className="icon-button cursor-pointer"
        >
          <EditIcon />
        </summary>
        <div className="mt-3 min-w-[36rem] rounded-[8px] border border-[rgba(17,17,17,0.1)] bg-white p-4">
          {children}
          <a href="/project-details" className="secondary-button mt-3 min-h-[2.5rem] px-3 text-sm">
            {cancelLabel}
          </a>
        </div>
      </details>
      <form action={deleteAction}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          aria-label={deleteAriaLabel}
          title={deleteAriaLabel}
          className="icon-button"
        >
          <TrashIcon />
        </button>
      </form>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="mt-4 rounded-[8px] border border-dashed border-[rgba(17,17,17,0.18)] p-4 text-sm text-[var(--ink-soft)]">
      {label}
    </div>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 6h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8 6V4h8v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 6l1 14h10l1-14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v5M14 11v5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
