package io.github.jackhudsonn.jaakd.service;

import io.github.jackhudsonn.jaakd.exception.ForbiddenException;
import io.github.jackhudsonn.jaakd.model.UserType;
import io.github.jackhudsonn.jaakd.repository.ProfileRepository;
import io.github.jackhudsonn.jaakd.security.CurrentUserService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.stream.Collectors;

// Backs @RequiresUserType; services declare the annotation rather than calling this directly.
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

    public void ensureUserType(UserType... allowed) {
        String deniedMessage = deniedMessage(allowed);
        BigDecimal userType = profileRepository.findById(currentUserService.getUserId())
            .map(profile -> profile.getUserType())
            .orElseThrow(() -> new ForbiddenException(deniedMessage));

        boolean permitted = Arrays.stream(allowed).anyMatch(type -> type.getCode().compareTo(userType) == 0);
        if (!permitted) {
            throw new ForbiddenException(deniedMessage);
        }
    }

    // e.g. "Admin or auditor user type is required"
    private static String deniedMessage(UserType[] allowed) {
        String names = Arrays.stream(allowed)
            .map(type -> type.name().toLowerCase().replace('_', ' '))
            .collect(Collectors.joining(" or "));
        return Character.toUpperCase(names.charAt(0)) + names.substring(1) + " user type is required";
    }
}
