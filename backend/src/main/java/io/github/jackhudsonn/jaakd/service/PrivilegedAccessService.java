package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.exception.ForbiddenException;
import io.github.jackhudsonn.jaakd.model.UserType;
import io.github.jackhudsonn.jaakd.repository.ProfileRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class PrivilegedAccessService {

    private final ProfileRepository profileRepository;
    private final CurrentUserService currentUserService;

    public PrivilegedAccessService(
        ProfileRepository profileRepository,
        CurrentUserService currentUserService
    ) {
        this.profileRepository = profileRepository;
        this.currentUserService = currentUserService;
    }

    public void ensureAdminOrAuditor() {
        BigDecimal userType = profileRepository.findById(currentUserService.getUserId())
            .map(profile -> profile.getUserType())
            .orElseThrow(() -> new ForbiddenException("Admin or auditor user type is required"));

        boolean isAdmin = UserType.ADMIN.getCode().compareTo(userType) == 0;
        boolean isAuditor = UserType.AUDITOR.getCode().compareTo(userType) == 0;

        if (!isAdmin && !isAuditor) {
            throw new ForbiddenException("Admin or auditor user type is required");
        }
    }
}
