package com.rnave.studily.parse;

import com.rnave.studily.user.UserRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AiUsageRecorder {

    private final CourseParseUsageRepository usageRepository;
    private final UserRepository userRepository;

    public AiUsageRecorder(CourseParseUsageRepository usageRepository, UserRepository userRepository) {
        this.usageRepository = usageRepository;
        this.userRepository = userRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(long userId, AiFeature feature, String model, long inputTokens, long outputTokens,
                       boolean succeeded) {
        CourseParseUsage usage = new CourseParseUsage();
        usage.setUser(userRepository.getReferenceById(userId));
        usage.setFeature(feature);
        usage.setModel(model);
        usage.setInputTokens(inputTokens);
        usage.setOutputTokens(outputTokens);
        usage.setSucceeded(succeeded);
        usageRepository.save(usage);
    }
}
