package io.github.jackhudsonn.jaakd.security;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import io.github.jackhudsonn.jaakd.model.UserType;

// Restricts a bean method (or every public method of a bean class) to callers
// whose profile has one of the given user types; anyone else gets a 403.
// Enforced through a Spring proxy, so calls from within the same class bypass
// the check — annotate the entry point that the caller actually invokes.
@Target({ ElementType.METHOD, ElementType.TYPE })
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RequiresUserType {

    UserType[] value();
}
