import { useEffect, useState } from "preact/hooks";

import { t } from "../../../services/i18n";
import FormGroup from "../../react/FormGroup";
import FormTextBox from "../../react/FormTextBox";
import type { HomeWidgetProps } from "./registry";

/** The local time and date, and the time in the `timeZone` setting when it names a valid zone. */
export default function ClockWidget({ widget }: HomeWidgetProps) {
    const now = useNow();
    const timeZone = widget.settings.timeZone;
    const second = timeZone && isValidTimeZone(timeZone) ? timeZone : null;

    return (
        <div className="helium-clock">
            <time className="helium-clock-time" dateTime={now.toISOString()}>{formatTime(now)}</time>
            <span className="helium-clock-date">{now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
            {second && (
                <span className="helium-clock-zone">
                    {t("helium_home.clock_zone", { zone: second.replaceAll("_", " "), time: formatTime(now, second) })}
                </span>
            )}
        </div>
    );
}

export function Settings({ widget, updateSettings }: HomeWidgetProps) {
    const [ value, setValue ] = useState(widget.settings.timeZone ?? "");
    const valid = !value || isValidTimeZone(value);

    return (
        <FormGroup name="helium-clock-zone" label={t("helium_home.clock_zone_label")}
            description={t("helium_home.clock_zone_hint")} error={valid ? undefined : t("helium_home.clock_zone_invalid")}>
            <FormTextBox
                currentValue={value}
                placeholder="Europe/Berlin"
                onChange={(newValue) => {
                    setValue(newValue);
                    if (!newValue.trim() || isValidTimeZone(newValue.trim())) {
                        updateSettings({ ...widget.settings, timeZone: newValue.trim() });
                    }
                }}
            />
        </FormGroup>
    );
}

export function isValidTimeZone(timeZone: string) {
    try {
        new Intl.DateTimeFormat(undefined, { timeZone });
        return true;
    } catch {
        return false;
    }
}

function formatTime(date: Date, timeZone?: string) {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", timeZone });
}

/** The current time, updated on each minute. */
function useNow() {
    const [ now, setNow ] = useState(() => new Date());
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const schedule = () => {
            timer = setTimeout(() => {
                setNow(new Date());
                schedule();
            }, 60_000 - (Date.now() % 60_000) + 50);
        };
        schedule();
        return () => clearTimeout(timer);
    }, []);
    return now;
}
