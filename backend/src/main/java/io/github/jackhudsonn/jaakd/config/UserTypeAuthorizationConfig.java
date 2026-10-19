package io.github.jackhudsonn.jaakd.config;

import java.lang.reflect.Method;

import org.aopalliance.intercept.MethodInterceptor;
import org.aopalliance.intercept.MethodInvocation;
import org.springframework.aop.Advisor;
import org.springframework.aop.support.AopUtils;
import org.springframework.aop.support.ComposablePointcut;
import org.springframework.aop.support.DefaultPointcutAdvisor;
import org.springframework.aop.support.annotation.AnnotationMatchingPointcut;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Role;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.AnnotatedElementUtils;

import io.github.jackhudsonn.jaakd.security.RequiresUserType;
import io.github.jackhudsonn.jaakd.service.PrivilegedAccessService;

// Enforces @RequiresUserType on bean methods before they run.
@Configuration(proxyBeanMethods = false)
public class UserTypeAuthorizationConfig {

    // Infrastructure role so the auto-proxy creator Spring already registers for
    // @Transactional picks this advisor up. Highest precedence so the check runs
    // before a transaction opens.
    @Bean
    @Role(BeanDefinition.ROLE_INFRASTRUCTURE)
    static Advisor requiresUserTypeAdvisor(ObjectProvider<PrivilegedAccessService> privilegedAccessService) {
        ComposablePointcut pointcut = new ComposablePointcut(new AnnotationMatchingPointcut(RequiresUserType.class, true))
                .union(new AnnotationMatchingPointcut(null, RequiresUserType.class, true));

        MethodInterceptor interceptor = invocation -> {
            privilegedAccessService.getObject().ensureUserType(findRequirement(invocation).value());
            return invocation.proceed();
        };

        DefaultPointcutAdvisor advisor = new DefaultPointcutAdvisor(pointcut, interceptor);
        advisor.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return advisor;
    }

    // A method-level annotation overrides the class-level one.
    private static RequiresUserType findRequirement(MethodInvocation invocation) {
        Class<?> targetClass = AopUtils.getTargetClass(invocation.getThis());
        Method method = AopUtils.getMostSpecificMethod(invocation.getMethod(), targetClass);

        RequiresUserType requirement = AnnotatedElementUtils.findMergedAnnotation(method, RequiresUserType.class);
        if (requirement == null) {
            requirement = AnnotatedElementUtils.findMergedAnnotation(targetClass, RequiresUserType.class);
        }
        return requirement;
    }
}
