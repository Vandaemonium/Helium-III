import { dayjs } from "@triliumnext/commons";
import { useState } from "preact/hooks";

import appContext from "../../../components/app_context";
import date_notes from "../../../services/date_notes";
import { t } from "../../../services/i18n";
import toast from "../../../services/toast";
import Calendar from "../../launch_bar/Calendar";
import { CalendarHeader } from "../../launch_bar/CalendarWidget";

/** A month of the journal: days with a day note are marked, and a click opens or creates that day's note. */
export default function HomeCalendar() {
    const [ date, setDate ] = useState(() => dayjs().startOf("month"));

    return (
        <div className="calendar-dropdown-widget helium-calendar">
            <CalendarHeader date={date} setDate={setDate} />
            <Calendar
                date={date}
                todaysDate={dayjs()}
                activeDate={null}
                weekNotes={[]}
                markDayNotes
                onDateClicked={async (day, e) => {
                    e.preventDefault();
                    await openDayNote(day);
                }}
            />
        </div>
    );
}

/** Opens the day note of `day` (`YYYY-MM-DD`) in the active tab, creating it as the launcher calendar does. */
export async function openDayNote(day: string) {
    const note = await date_notes.getDayNote(day);
    if (note) {
        await appContext.tabManager.getActiveContext()?.setNote(note.noteId);
    } else {
        toast.showError(t("calendar.cannot_find_day_note"));
    }
}
