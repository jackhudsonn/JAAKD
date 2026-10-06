package io.github.jackhudsonn.jaakd.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import io.github.jackhudsonn.jaakd.model.User;

import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
}
