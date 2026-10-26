package com.rnave.studily.ics;

import com.rnave.studily.canvas.CanvasDtos.FeedRequest;
import com.rnave.studily.canvas.SchoolFeedService;
import com.rnave.studily.ics.IcsDtos.ImportResult;
import com.rnave.studily.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CalendarLinkService {

    private final IcsService icsService;
    private final SchoolFeedService schoolFeedService;

    public CalendarLinkService(IcsService icsService, SchoolFeedService schoolFeedService) {
        this.icsService = icsService;
        this.schoolFeedService = schoolFeedService;
    }

    @Transactional
    public ImportResult importLink(User user, String source, String timeZone) {
        String text = icsService.fetchText(source);
        Long feedId = schoolFeedService.remember(user, new FeedRequest(source, timeZone, null, true), SchoolFeedService.CALENDAR_PROVIDER);
        return icsService.sync(user, text, timeZone, feedId, icsService.isPublicGoogleFeed(source)).result();
    }
}
