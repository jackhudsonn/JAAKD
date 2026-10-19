package io.github.jackhudsonn.jaakd.config;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.lang.reflect.AnnotatedElement;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.aop.support.AopUtils;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.aop.AopAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.annotation.AnnotatedElementUtils;

import io.github.jackhudsonn.jaakd.dto.CreateInstrumentRequest;
import io.github.jackhudsonn.jaakd.dto.UpdateInstrumentRequest;
import io.github.jackhudsonn.jaakd.exception.ForbiddenException;
import io.github.jackhudsonn.jaakd.model.CashCurrency;
import io.github.jackhudsonn.jaakd.model.UserType;
import io.github.jackhudsonn.jaakd.security.RequiresUserType;
import io.github.jackhudsonn.jaakd.service.AuditService;
import io.github.jackhudsonn.jaakd.service.InstrumentService;
import io.github.jackhudsonn.jaakd.service.OrderLogService;
import io.github.jackhudsonn.jaakd.service.PortfolioReconciliationService;
import io.github.jackhudsonn.jaakd.service.PrivilegedAccessService;

class UserTypeAuthorizationConfigTest {

    private final PrivilegedAccessService privilegedAccessService = mock(PrivilegedAccessService.class);
    private final AtomicInteger guardedInvocations = new AtomicInteger();

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(AopAutoConfiguration.class))
            .withUserConfiguration(UserTypeAuthorizationConfig.class)
            .withBean(PrivilegedAccessService.class, () -> privilegedAccessService)
            .withBean(GuardedBean.class, () -> new GuardedBean(guardedInvocations))
            .withBean(OpenBean.class);

    @Test
    void classLevelAnnotation_checksDeclaredUserTypes() {
        contextRunner.run(context -> {
            assertEquals("class", context.getBean(GuardedBean.class).classLevel());
            verify(privilegedAccessService).ensureUserType(UserType.AUDITOR);
        });
    }

    @Test
    void methodLevelAnnotation_overridesClassLevel() {
        contextRunner.run(context -> {
            assertEquals("method", context.getBean(GuardedBean.class).methodLevel());
            verify(privilegedAccessService).ensureUserType(UserType.ADMIN);
        });
    }

    @Test
    void deniedCaller_neverReachesMethodBody() {
        doThrow(new ForbiddenException("Auditor user type is required"))
                .when(privilegedAccessService).ensureUserType(any(UserType[].class));

        contextRunner.run(context -> {
            GuardedBean bean = context.getBean(GuardedBean.class);

            assertThrows(ForbiddenException.class, bean::classLevel);
            assertEquals(0, guardedInvocations.get());
        });
    }

    @Test
    void unannotatedBean_isNotProxiedOrChecked() {
        contextRunner.run(context -> {
            OpenBean bean = context.getBean(OpenBean.class);

            assertFalse(AopUtils.isAopProxy(bean));
            assertEquals("open", bean.open());
            verifyNoInteractions(privilegedAccessService);
        });
    }

    // Pins which service entry points are privileged, replacing the per-service
    // verify(privilegedAccessService) assertions the unit tests used to make.
    @Test
    void privilegedServiceEntryPoints_declareExpectedUserTypes() throws Exception {
        UserType[] adminOrAuditor = { UserType.ADMIN, UserType.AUDITOR };
        UserType[] adminOnly = { UserType.ADMIN };

        assertRequires(adminOrAuditor, AuditService.class);
        assertRequires(adminOrAuditor, OrderLogService.class.getMethod("getOrderLogsForPortfolioDiagnostics", UUID.class));
        assertRequires(adminOrAuditor, PortfolioReconciliationService.class.getMethod("reconcilePortfolio", UUID.class));

        assertRequires(adminOnly, InstrumentService.class.getMethod("createInstrument", CreateInstrumentRequest.class));
        assertRequires(adminOnly, InstrumentService.class.getMethod("updateInstrument", UUID.class, UpdateInstrumentRequest.class));
        assertRequires(adminOnly, InstrumentService.class.getMethod("createOrUpdateFromExternalData", String.class));
        assertRequires(adminOnly, InstrumentService.class.getMethod(
                "createOrUpdateCryptoFromExternalData", String.class, CashCurrency.class));

        assertNull(AnnotatedElementUtils.findMergedAnnotation(InstrumentService.class, RequiresUserType.class));
        assertNull(AnnotatedElementUtils.findMergedAnnotation(
                InstrumentService.class.getMethod("getAllInstruments"), RequiresUserType.class));
        assertNull(AnnotatedElementUtils.findMergedAnnotation(
                InstrumentService.class.getMethod("getInstrumentById", UUID.class), RequiresUserType.class));
    }

    private static void assertRequires(UserType[] expected, AnnotatedElement element) {
        RequiresUserType requirement = AnnotatedElementUtils.findMergedAnnotation(element, RequiresUserType.class);
        assertArrayEquals(expected, requirement == null ? null : requirement.value(), element.toString());
    }

    @RequiresUserType(UserType.AUDITOR)
    public static class GuardedBean {

        private final AtomicInteger invocations;

        public GuardedBean(AtomicInteger invocations) {
            this.invocations = invocations;
        }

        public String classLevel() {
            invocations.incrementAndGet();
            return "class";
        }

        @RequiresUserType(UserType.ADMIN)
        public String methodLevel() {
            invocations.incrementAndGet();
            return "method";
        }
    }

    public static class OpenBean {

        public String open() {
            return "open";
        }
    }
}
