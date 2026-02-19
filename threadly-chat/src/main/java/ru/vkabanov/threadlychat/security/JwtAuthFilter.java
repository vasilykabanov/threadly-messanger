package ru.vkabanov.threadlychat.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Collections;

@Component
@Slf4j
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtConfig jwtConfig;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader(jwtConfig.getHeader());
        if (!StringUtils.hasText(header) || !header.startsWith(jwtConfig.getPrefix())) {
            log.debug("JWT missing or no header for {} {}", request.getMethod(), request.getRequestURI());
            filterChain.doFilter(request, response);
            return;
        }

        String token = header.replace(jwtConfig.getPrefix(), "").trim();
        try {
            Claims claims = Jwts.parser()
                    .setSigningKey(jwtConfig.getSecret().getBytes())
                    .parseClaimsJws(token)
                    .getBody();

            String username = claims.getSubject();
            Object userIdObj = claims.get("userId");
            String userId = userIdObj != null ? userIdObj.toString() : null;

            if (userId == null || userId.isEmpty()) {
                log.warn("JWT has no userId claim for {} {}", request.getMethod(), request.getRequestURI());
                filterChain.doFilter(request, response);
                return;
            }

            CurrentUser currentUser = new CurrentUser(userId, username);
            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                    currentUser, null, Collections.emptyList());
            SecurityContextHolder.getContext().setAuthentication(auth);
        } catch (SignatureException e) {
            log.debug("Invalid JWT signature for {} {}", request.getMethod(), request.getRequestURI());
        } catch (Exception e) {
            log.warn("JWT parse error for {} {}: {}", request.getMethod(), request.getRequestURI(), e.getMessage());
        }

        filterChain.doFilter(request, response);
    }
}
