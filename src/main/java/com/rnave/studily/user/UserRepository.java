package com.rnave.studily.user;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByUsername(String username);

    boolean existsByEmail(String email);

    boolean existsByUsernameIgnoreCase(String username);

    Slice<User> findBySchoolIgnoreCaseAndIdNotOrderByNameAsc(String school, Long id, Pageable pageable);

    Slice<User> findByUsernameContainingIgnoreCaseAndIdNotOrderByUsernameAsc(String username, Long id, Pageable pageable);
}
